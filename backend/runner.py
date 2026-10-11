"""LLM driven adaptations of the three AgentSociety2 games examples."""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
RUNS = Path(os.getenv("SOCIETY_LAB_RUNS_DIR", str(ROOT / "data" / "runs")))
ENV_FILE = Path(os.getenv("SOCIETY_LAB_ENV_FILE", str(ROOT / ".env")))
ENV_NAMES = ("AGENTSOCIETY_LLM_API_KEY", "AGENTSOCIETY_LLM_API_BASE", "AGENTSOCIETY_LLM_MODEL")


def llm_config() -> dict[str, str]:
    file_values = dotenv_values(ENV_FILE) if ENV_FILE.exists() else {}
    values = {name: str((file_values[name] if name in file_values else os.getenv(name)) or "").strip() for name in ENV_NAMES}
    missing = [name for name, value in values.items() if not value]
    if missing:
        raise ValueError("运行前请配置 LLM：" + "、".join(missing))
    return values


async def execute(config: dict) -> dict:
    connection = llm_config()
    os.environ.update(connection)
    from agentsociety2.config.llm_dispatcher import LLMClient
    from agentsociety2.contrib.env.prisoners_dilemma import PrisonersDilemmaEnv
    from agentsociety2.contrib.env.public_goods import PublicGoodsEnv
    from agentsociety2.contrib.env.reputation_game import ReputationGameConfig, ReputationGameEnv
    from agentsociety2.storage import ColumnDef, ReplayWriter, TableSchema

    example, agents = config["example"], config["agents"]
    settings, rules, skills = config["environment"], config["rules"], config["skills"]
    run_id = uuid4().hex
    run_dir = RUNS / run_id
    run_dir.mkdir(parents=True)
    timestamp = datetime.now(timezone.utc)
    events: list[dict] = []
    result = {
        "id": run_id, "example": example, "created_at": timestamp.isoformat(),
        "mode": "llm", "status": "running", "events": events,
        "inputs": {"agents": agents, "environment": settings, "rules": rules, "skills": skills},
        "model": connection[ENV_NAMES[2]],
    }
    writer = ReplayWriter(run_dir / "replay")
    await writer.init()
    await writer.register_table(TableSchema(name="game_events", columns=[
        ColumnDef("step", "INTEGER"), ColumnDef("action", "TEXT"), ColumnDef("result", "TEXT"),
    ]))

    async def record(action: str, value: object) -> None:
        event = {"step": len(events) + 1, "action": action, "result": value}
        events.append(event)
        await writer.write("game_events", {
            "step": event["step"], "action": action,
            "result": json.dumps(value, ensure_ascii=False, default=str),
        })

    for skill in skills:
        if skill["enabled"]:
            skill_dir = run_dir / "skills" / skill["name"]
            skill_dir.mkdir(parents=True, exist_ok=True)
            description = skill["description"].replace("\n", " ").replace("\r", " ")
            skill_text = f"---\nname: {skill['name']}\ndescription: {json.dumps(description, ensure_ascii=False)}\n---\n\n{skill['instructions']}\n"
            (skill_dir / "SKILL.md").write_text(skill_text, encoding="utf-8")

    client = LLMClient(
        model_name=connection[ENV_NAMES[2]], base_url=connection[ENV_NAMES[1]],
        api_key=connection[ENV_NAMES[0]],
    )
    skill_prompt = "\n\n".join(
        f"Skill {skill['name']}: {skill['description']}\n{skill['instructions']}"
        for skill in skills if skill["enabled"]
    )

    async def decide(agent: dict, prompt: str, allowed: set[str]) -> dict:
        system = (
            f"You are {agent['name']}. Personality: {agent['personality']}. "
            f"Background: {agent['bio']}. Make your own game decision. "
            "Respond with one JSON object only, using keys action and reason. "
            "Do not put markdown around it."
        )
        if skill_prompt:
            system += "\n\nEnabled agent skills:\n" + skill_prompt
        response = await client.call(messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ], thinking="off", max_retries=1)
        content = response.choices[0].message.content or ""
        try:
            decision = json.loads(content.strip().removeprefix("```json").removesuffix("```").strip())
            action = str(decision["action"]).lower().strip()
            if action not in allowed:
                raise ValueError("invalid action")
        except (ValueError, KeyError, TypeError) as exc:
            raise ValueError(f"{agent['name']} 的模型决策格式无效：{content[:300]}") from exc
        await record("LLM 决策", {"agent": agent["name"], "action": action, "reason": decision.get("reason", "")})
        return decision

    try:
        if example == "prisoners_dilemma":
            game = PrisonersDilemmaEnv(
                payoff_cc=rules["payoff_cc"], payoff_cd=rules["payoff_cd"],
                payoff_dc=rules["payoff_dc"], payoff_dd=rules["payoff_dd"],
            )
            game.set_replay_writer(writer)
            await game.init(timestamp)
            matrix = (await game.get_payoff_matrix()).model_dump(mode="json")
            await record("囚徒困境规则", matrix)
            for agent in agents:
                decision = await decide(agent, (
                    f"Choose COOPERATE or DEFECT. You do not know the other player's choice. "
                    f"The payoff matrix is {matrix}. Use action='cooperate' or 'defect'."
                ), {"cooperate", "defect"})
                await game.submit_action(agent["name"], "Yes" if decision["action"].lower() == "cooperate" else "No")
            await game.step(1, timestamp)
            await record("博弈结果", await game.get_round_history())

        elif example == "public_goods":
            game = PublicGoodsEnv(
                num_agents=len(agents), initial_endowment=settings["endowment"],
                public_pool_multiplier=settings["contribution_factor"],
            )
            game.set_replay_writer(writer)
            await game.init(timestamp)
            for round_number in range(1, settings["rounds"] + 1):
                history = await game.get_round_history()
                for agent in agents:
                    decision = await decide(agent, (
                        f"Public goods round {round_number}. You have {settings['endowment']} coins. "
                        f"Contributions are multiplied by {settings['contribution_factor']} "
                        f"and divided equally among {len(agents)} players. "
                        f"Previous rounds: {json.dumps(history, ensure_ascii=False)}. "
                        f"Set action to an integer from 0 to {settings['endowment']}."
                    ), {str(n) for n in range(settings["endowment"] + 1)})
                    await game.submit_contribution(agent["name"], int(decision["action"]))
                await game.step(1, timestamp)
                await record(f"第 {round_number} 轮结果", (await game.get_round_history(round_number))[0])

        elif example == "reputation_game":
            game = ReputationGameEnv(ReputationGameConfig(
                Z=len(agents), BENEFIT=rules["benefit"], COST=rules["cost"],
                norm_type=rules["norm_type"], seed=rules["seed"],
            ))
            game.set_replay_writer(writer)
            await game.init(timestamp)
            for round_number in range(1, settings["rounds"] + 1):
                for donor_id, agent in enumerate(agents):
                    recipient_id = (donor_id + round_number) % len(agents)
                    reputation = (await game.get_agent_reputation(recipient_id)).model_dump(mode="json")
                    decision = await decide(agent, (
                        f"Reputation game round {round_number}. Recipient {agents[recipient_id]['name']} "
                        f"has reputation {reputation['reputation']}. Cooperation costs you {rules['cost']} "
                        f"and gives the recipient {rules['benefit']}. The social norm is {rules['norm_type']}. "
                        "Set action to 'cooperate' or 'defect'."
                    ), {"cooperate", "defect"})
                    outcome = await game.execute_donation(donor_id, recipient_id, decision["action"])
                    await record("捐赠互动", outcome.model_dump(mode="json"))
                await game.step(1, timestamp)
            await record("全局统计", (await game.get_global_statistics()).model_dump(mode="json"))
            await record("声誉分布", (await game.get_reputation_distribution()).model_dump(mode="json"))
            for agent_id, agent in enumerate(agents):
                payoff = await game.get_agent_payoff(agent_id)
                reputation = await game.get_agent_reputation(agent_id)
                await record("Agent 结果", {"agent": agent["name"], "payoff": payoff.model_dump(mode="json"), "reputation": reputation.model_dump(mode="json")})
        else:
            raise ValueError("未知示例")
        result["status"] = "completed"
        result["token_usage"] = client.snapshot_token_stats()
    except Exception as exc:
        result["status"] = "failed"
        result["error"] = str(exc).replace(connection[ENV_NAMES[0]], "***")
    finally:
        await writer.close()
        (run_dir / "result.json").write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result
