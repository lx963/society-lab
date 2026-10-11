import json
import os
import re
from pathlib import Path
from typing import Literal

from dotenv import dotenv_values, load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"
load_dotenv(ENV_FILE)
from .runner import ENV_NAMES, RUNS, execute, llm_config  # noqa: E402

app = FastAPI(title="AgentSociety2 博弈实验台")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])


def read_only() -> bool:
    return os.getenv("SOCIETY_LAB_READ_ONLY", "").lower() in {"1", "true", "yes"}


def require_writable():
    if read_only():
        raise HTTPException(status_code=403, detail="当前站点仅供展示，模型配置与新建实验已关闭。")


def run_directories():
    return [RUNS, ROOT / "examples" / "offline"] if read_only() else [RUNS]


class Agent(BaseModel):
    id: int = Field(ge=1)
    name: str = Field(min_length=1, max_length=60)
    age: int = Field(default=28, ge=0, le=120)
    personality: str = Field(default="curious", max_length=300)
    bio: str = Field(default="", max_length=500)


class Environment(BaseModel):
    rounds: int = Field(default=3, ge=1, le=15)
    endowment: int = Field(default=100, ge=1, le=1000)
    contribution_factor: float = Field(default=1.5, gt=0, le=10)


class Rules(BaseModel):
    payoff_cc: int = Field(default=3, ge=-1000, le=1000)
    payoff_cd: int = Field(default=0, ge=-1000, le=1000)
    payoff_dc: int = Field(default=5, ge=-1000, le=1000)
    payoff_dd: int = Field(default=1, ge=-1000, le=1000)
    benefit: int = Field(default=5, ge=0, le=1000)
    cost: int = Field(default=1, ge=0, le=1000)
    norm_type: Literal["image_score", "simple_standing", "stern_judging"] = "stern_judging"
    seed: int = 42


class Skill(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=500)
    instructions: str = Field(default="", max_length=10000)
    enabled: bool = False

    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", value):
            raise ValueError("技能名称只能包含小写字母、数字和连字符")
        return value


class RunRequest(BaseModel):
    example: Literal["prisoners_dilemma", "public_goods", "reputation_game"]
    agents: list[Agent] = Field(min_length=2, max_length=30)
    environment: Environment = Field(default_factory=Environment)
    rules: Rules = Field(default_factory=Rules)
    skills: list[Skill] = Field(default_factory=list, max_length=30)

    @model_validator(mode="after")
    def validate_agents(self):
        if len({agent.id for agent in self.agents}) != len(self.agents):
            raise ValueError("Agent ID 必须唯一")
        if len({agent.name for agent in self.agents}) != len(self.agents):
            raise ValueError("Agent 姓名必须唯一")
        if self.example == "prisoners_dilemma" and len(self.agents) != 2:
            raise ValueError("囚徒困境需要恰好 2 个 Agent")
        return self


class EnvUpdate(BaseModel):
    api_key: str | None = None
    api_base: str | None = None
    model: str | None = None


@app.get("/api/config")
def config():
    if read_only():
        return {"mode": "showcase", "read_only": True, "env": {
            "api_key_configured": False, "api_base": "", "model": "",
        }}
    values = dotenv_values(ENV_FILE) if ENV_FILE.exists() else {}
    return {"mode": "llm", "read_only": False, "env": {
        "api_key_configured": bool(values[ENV_NAMES[0]] if ENV_NAMES[0] in values else os.getenv(ENV_NAMES[0])),
        "api_base": (values[ENV_NAMES[1]] if ENV_NAMES[1] in values else os.getenv(ENV_NAMES[1])) or "",
        "model": (values[ENV_NAMES[2]] if ENV_NAMES[2] in values else os.getenv(ENV_NAMES[2])) or "",
    }}


@app.post("/api/config", dependencies=[Depends(require_writable)])
def save_config(payload: EnvUpdate):
    values = dict(dotenv_values(ENV_FILE)) if ENV_FILE.exists() else {}
    updates = {ENV_NAMES[0]: payload.api_key, ENV_NAMES[1]: payload.api_base, ENV_NAMES[2]: payload.model}
    for name, value in updates.items():
        if value is not None:
            values[name] = value.strip()
    content = "".join(f"{name}={json.dumps(values.get(name) or '')}\n" for name in ENV_NAMES)
    temp = ENV_FILE.with_suffix(".env.tmp")
    temp.write_text(content, encoding="utf-8")
    temp.chmod(0o600)
    temp.replace(ENV_FILE)
    return config()


@app.post("/api/runs", dependencies=[Depends(require_writable)])
async def run(payload: RunRequest):
    try:
        llm_config()
        return await execute(payload.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.get("/api/runs")
def list_runs():
    records = [{"id": p.parent.name, "example": (r := json.loads(p.read_text(encoding="utf-8")))["example"], "created_at": r["created_at"], "status": r["status"]} for directory in run_directories() for p in directory.glob("*/result.json")]
    return sorted(records, key=lambda record: record["created_at"], reverse=True)[:30]


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    if len(run_id) != 32 or not all(c in "0123456789abcdef" for c in run_id):
        raise HTTPException(status_code=404, detail="运行不存在")
    for directory in run_directories():
        path = directory / run_id / "result.json"
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    raise HTTPException(status_code=404, detail="运行不存在")
