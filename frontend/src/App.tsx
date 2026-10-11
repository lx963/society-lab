import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import './App.css'

type Example = 'prisoners_dilemma' | 'public_goods' | 'reputation_game'
type View = 'configuration' | 'results'
type ConfigTab = 'basic' | 'agents' | 'environment' | 'rules' | 'skills' | 'env'

type Agent = { id: number; name: string; age: number; personality: string; bio: string }
type Skill = { name: string; description: string; instructions: string; enabled: boolean }
type Form = {
  example: Example
  agents: Agent[]
  environment: { rounds: number; endowment: number; contribution_factor: number }
  rules: { payoff_cc: number; payoff_cd: number; payoff_dc: number; payoff_dd: number; benefit: number; cost: number; norm_type: string; seed: number }
  skills: Skill[]
}
type Event = { step: number; action: string; result: unknown }
type Run = { id: string; example: Example; created_at: string; status: string; events: Event[]; inputs: Omit<Form, 'example'>; model: string; error?: string }
type RunSummary = Pick<Run, 'id' | 'example' | 'created_at' | 'status'>
type EnvState = { api_key_configured: boolean; api_base: string; model: string }
type FormSetter = Dispatch<SetStateAction<Form>>
type Draft = { name: string; form: Form; savedAt: string }
type IconName = 'network' | 'users' | 'building' | 'chart' | 'clock' | 'flag' | 'file' | 'box' | 'settings' | 'play' | 'check' | 'chevron' | 'plus' | 'arrow'

function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    network: <><path d="m12 5-6 6m6-6 6 6M6 14v5m12-5v5m-6-5v5m-4-7h8m-4-7v5"/><circle cx="12" cy="3" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="21" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="21" r="2"/><circle cx="19" cy="21" r="2"/></>,
    users: <><circle cx="12" cy="7" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3M4 5a3 3 0 0 0 0 6m16-6a3 3 0 0 1 0 6M2 20v-3a5 5 0 0 1 3-4m17 7v-3a5 5 0 0 0-3-4"/></>,
    building: <><path d="M4 21V5l8-3v19M12 8h8v13M2 21h20M7 7h2m-2 4h2m-2 4h2m7-3h2m-2 4h2M8 21v-3"/></>,
    chart: <><path d="M4 3v18h18M8 16v-5m5 5V6m5 10V9"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    flag: <><path d="M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0"/></>,
    file: <><path d="M14 2H5v20h14V7l-5-5v5h5M8 12h8m-8 4h5"/></>,
    box: <><path d="m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10v10M3 7l9 5 9-5M7 5l9 5"/></>,
    settings: <><path d="m10 3 .5-1h3l.5 3 2 .9 2.5-1.4 2 2-1.4 2.5.9 2 3 .5v3l-3 .5-.9 2 1.4 2.5-2 2-2.5-1.4-2 .9-.5 3h-3l-.5-3-2-.9-2.5 1.4-2-2L4.9 16l-.9-2-3-.5v-3l3-.5.9-2L3.5 5.5l2-2L8 4.9l2-.9Z"/><circle cx="12" cy="12" r="3"/></>,
    play: <path d="m8 4 12 8-12 8V4Z"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    chevron: <path d="m6 9 6 6 6-6"/>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
  }
  return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

const DRAFT_KEY = 'society-lab-workspace-draft-v1'
function readDraft(): Draft | null {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null') as Draft | null
    if (!value || typeof value.name !== 'string' || typeof value.savedAt !== 'string') return null
    const form = value.form
    if (!form || !Object.hasOwn(titles, form.example) || !Array.isArray(form.agents) || form.agents.length < 2 || form.agents.length > 30 || !Array.isArray(form.skills)) return null
    if (!form.agents.every(agent => typeof agent.name === 'string' && typeof agent.id === 'number' && typeof agent.age === 'number' && typeof agent.personality === 'string' && typeof agent.bio === 'string')) return null
    if (!form.skills.every(skill => typeof skill.name === 'string' && typeof skill.instructions === 'string' && typeof skill.description === 'string' && typeof skill.enabled === 'boolean')) return null
    const defaults = createInitialForm()
    if (!form.environment || !form.rules || !Object.entries(defaults.environment).every(([key]) => typeof form.environment[key as keyof Form['environment']] === 'number') || !Object.entries(defaults.rules).every(([key, item]) => typeof form.rules[key as keyof Form['rules']] === typeof item)) return null
    return value
  } catch { return null }
}

function resizeAgents(form: Form, count: number): Agent[] {
  const agents = form.agents.slice(0, count)
  for (let index = agents.length; index < count; index++) {
    const id = Math.max(0, ...agents.map(agent => agent.id)) + 1
    let name = ['Alice', 'Bob', 'Charlie', 'Diana'][index] || `Agent ${id}`
    while (agents.some(agent => agent.name === name)) name += ` ${id}`
    agents.push({ id, name, age: 28, personality: ['altruistic', 'self-interested', 'cautious', 'optimistic'][index % 4], bio: '' })
  }
  return agents
}

const titles: Record<Example, string> = {
  prisoners_dilemma: '囚徒困境',
  public_goods: '公共物品博弈',
  reputation_game: '声誉博弈',
}
const captions: Record<Example, string> = {
  prisoners_dilemma: '两人合作或背叛 · 决策与收益',
  public_goods: '多人出资与公共收益分配',
  reputation_game: '捐赠互动 · 声誉与收益统计',
}
const tabs: Array<[ConfigTab, string]> = [
  ['agents', 'Agent 定义'],
  ['environment', '环境参数'],
  ['rules', '行为规则'],
  ['skills', 'Agent 技能'],
  ['env', '模型设置'],
]

function createInitialForm(): Form {
  return {
    example: 'prisoners_dilemma',
    agents: [
      { id: 1, name: 'Alice', age: 28, personality: 'friendly, curious', bio: 'Loves hiking and reading.' },
      { id: 2, name: 'Bob', age: 30, personality: 'thoughtful', bio: 'Interested in simulations.' },
    ],
    environment: { rounds: 3, endowment: 100, contribution_factor: 1.5 },
    rules: { payoff_cc: 3, payoff_cd: 0, payoff_dc: 5, payoff_dd: 1, benefit: 5, cost: 1, norm_type: 'stern_judging', seed: 42 },
    skills: [],
  }
}

async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? undefined : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const text = await response.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new Error(text || `请求失败（${response.status}）`)
  }
  if (!response.ok) {
    const detail = typeof data === 'object' && data !== null && 'detail' in data ? data.detail : data
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
  return data as T
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function Field({ label, value, onChange, type = 'text', placeholder = '', min, max, step, disabled = false, suffix }: { label: string; value: string | number; onChange: (value: string) => void; type?: string; placeholder?: string; min?: number; max?: number; step?: number; disabled?: boolean; suffix?: string }) {
  return <label className="field"><span>{label}</span><div className="input-wrap"><input type={type} value={value} placeholder={placeholder} min={min} max={max} step={step} disabled={disabled} onChange={event => onChange(event.target.value)} />{suffix && <span className="input-suffix">{suffix}</span>}</div></label>
}

function Sidebar({ view, form, name, busy, run, history, onNew, onView, onChoose, onSettings, onOpenRun }: { view: View; form: Form; name: string; busy: boolean; run: Run | null; history: RunSummary[]; onNew: () => void; onView: (view: View) => void; onChoose: (example: Example) => void; onSettings: (tab: ConfigTab) => void; onOpenRun: (id: string) => void }) {
  const [historyOpen, setHistoryOpen] = useState(() => window.matchMedia('(min-width: 751px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 751px)')
    const update = () => setHistoryOpen(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return <aside className="sidebar">
    <div className="brand"><Icon name="network" className="logo"/><div><strong>社科试验台</strong><small>Social Science Simulation Lab</small></div></div>
    <div className="side-label">仿真实验</div>
    <button className="workspace-create" onClick={onNew} disabled={busy}><Icon name="plus"/>新建实验</button>
    <nav className="side-nav" aria-label="仿真实验">
      <button className={`experiment-link ${view === 'configuration' ? 'active' : ''}`} onClick={() => onView('configuration')} aria-current={view === 'configuration' ? 'page' : undefined}><Icon name="network"/><span><strong>{name || '未命名实验'}</strong><small className="badge blue">{busy ? '运行中' : '草稿'}</small></span></button>
      {(Object.keys(titles) as Example[]).filter(example => example !== form.example).map(example => <button className="experiment-link" key={example} disabled={busy} onClick={() => onChoose(example)}><Icon name={example === 'public_goods' ? 'building' : example === 'reputation_game' ? 'chart' : 'users'}/><span><strong>{titles[example]}</strong><small className="template-label">实验方案</small></span></button>)}
    </nav>
    <details className="history-section" open={historyOpen} onToggle={event => setHistoryOpen(event.currentTarget.open)}><summary>最近运行 <span>{history.length}<Icon name="chevron"/></span></summary><div className="history">{history.length ? history.map(item => <button key={item.id} className={view === 'results' && run?.id === item.id ? 'active' : ''} onClick={() => onOpenRun(item.id)}><span>{titles[item.example] || item.example}<i className={`run-dot ${item.status === 'completed' ? 'success' : 'failed'}`}/></span><small>{new Date(item.created_at).toLocaleString('zh-CN')}</small></button>) : <p className="history-empty">运行实验后，在这里查看记录。</p>}</div></details>
    <nav className="utility-nav" aria-label="工作台工具"><button className={view === 'results' ? 'active' : ''} onClick={() => onView('results')}><Icon name="chart"/>实验结果</button><button onClick={() => onSettings('env')}><Icon name="box"/>模型配置</button><button onClick={() => onSettings('skills')}><Icon name="settings"/>Agent 技能</button></nav>
    <div className="side-foot"><span className="status-dot"/>本地实验环境</div>
  </aside>
}

function BasicConfiguration({ form, setForm, name, setName, env, onChoose, setTab }: { form: Form; setForm: FormSetter; name: string; setName: (name: string) => void; env: EnvState; onChoose: (example: Example) => void; setTab: (tab: ConfigTab) => void }) {
  const isSingleRound = form.example === 'prisoners_dilemma'
  return <section className="basic-panel panel" aria-labelledby="parameters-title">
    <div className="panel-heading"><div><h2 id="parameters-title">参数配置</h2><p>定义实验范围、Agent 行为与仿真规则</p></div><span className="basic-tab">基础设置</span></div>
    <div className="basic-grid">
      <Field label="实验名称" value={name} onChange={setName} placeholder="为这次实验命名"/>
      <label className="field"><span>研究主题</span><select value={form.example} onChange={event => onChoose(event.target.value as Example)}>{(Object.keys(titles) as Example[]).map(example => <option key={example} value={example}>{titles[example]} · {captions[example].split(' · ')[0]}</option>)}</select></label>
      <Field label="Agent 数量" type="number" min={2} max={30} step={1} suffix="个" disabled={isSingleRound} value={form.agents.length} onChange={value => { const count = Number(value); if (Number.isInteger(count) && count >= 2 && count <= 30) setForm(current => ({ ...current, agents: resizeAgents(current, count) })) }}/>
      <Field label="仿真轮次" type="number" min={1} max={15} step={1} suffix="轮" disabled={isSingleRound} value={isSingleRound ? 1 : form.environment.rounds} onChange={value => setForm(current => ({ ...current, environment: { ...current.environment, rounds: Number(value) } }))}/>
      {form.example === 'public_goods' ? <><Field label="每人初始金额" type="number" min={1} max={1000} value={form.environment.endowment} onChange={value => setForm(current => ({ ...current, environment: { ...current.environment, endowment: Number(value) } }))}/><Field label="公共资金倍数" type="number" min={0.1} max={10} step={0.1} value={form.environment.contribution_factor} onChange={value => setForm(current => ({ ...current, environment: { ...current.environment, contribution_factor: Number(value) } }))}/></> : <><Field label={form.example === 'reputation_game' ? '随机种子' : '双方合作收益'} type="number" step={1} value={form.example === 'reputation_game' ? form.rules.seed : form.rules.payoff_cc} onChange={value => setForm(current => ({ ...current, rules: { ...current.rules, [current.example === 'reputation_game' ? 'seed' : 'payoff_cc']: Number(value) } }))}/><Field label={form.example === 'reputation_game' ? '捐赠成本' : '双方背叛收益'} type="number" value={form.example === 'reputation_game' ? form.rules.cost : form.rules.payoff_dd} onChange={value => setForm(current => ({ ...current, rules: { ...current.rules, [current.example === 'reputation_game' ? 'cost' : 'payoff_dd']: Number(value) } }))}/></>}
    </div>
    <div className="basic-options"><button onClick={() => setTab('rules')}><span>行为规则</span><span className="option-value">{form.example === 'reputation_game' ? '声誉规范' : form.example === 'public_goods' ? '公共收益分配' : '收益矩阵'}<Icon name="chevron"/></span></button><button onClick={() => setTab('env')}><span>模型连接</span><span className={`connection ${env.api_key_configured && env.model ? 'ready' : ''}`}><i/>{env.api_key_configured && env.model ? '已配置' : '待配置'}<Icon name="chevron"/></span></button></div>
    <p className="basic-note"><span className="info-mark">i</span>{isSingleRound ? '囚徒困境采用 2 个 Agent、单轮博弈，可在高级设置中调整角色与收益矩阵。' : `支持 2–30 个 Agent、1–15 轮仿真，可在高级设置中定义角色与行为。`}</p>
  </section>
}

function ConfigEditor({ form, setForm, tab, setTab, env, keyValue, setKeyValue, setEnv, busy, saved, onSave }: { form: Form; setForm: FormSetter; tab: ConfigTab; setTab: (tab: ConfigTab) => void; env: EnvState; keyValue: string; setKeyValue: (value: string) => void; setEnv: Dispatch<SetStateAction<EnvState>>; busy: boolean; saved: boolean; onSave: () => void }) {
  const updateAgent = (index: number, key: keyof Agent, value: string) => setForm(current => ({ ...current, agents: current.agents.map((agent, itemIndex) => index === itemIndex ? { ...agent, [key]: key === 'id' || key === 'age' ? Number(value) : value } : agent) }))
  const updateSkill = (index: number, key: keyof Skill, value: string | boolean) => setForm(current => ({ ...current, skills: current.skills.map((skill, itemIndex) => index === itemIndex ? { ...skill, [key]: value } : skill) }))
  const updateEnvironment = (key: keyof Form['environment'], value: string) => setForm(current => ({ ...current, environment: { ...current.environment, [key]: Number(value) } }))
  const updateRule = (key: keyof Form['rules'], value: string) => setForm(current => ({ ...current, rules: { ...current.rules, [key]: key === 'norm_type' ? value : Number(value) } }))
  const addAgent = () => setForm(current => ({ ...current, agents: resizeAgents(current, current.agents.length + 1) }))
  const addSkill = () => setForm(current => {
    let count = current.skills.length + 1
    while (current.skills.some(skill => skill.name === `skill-${count}`)) count++
    return { ...current, skills: [...current.skills, { name: `skill-${count}`, description: '', instructions: '', enabled: false }] }
  })

  return <div className="config-editor">
    <div className="subnav" aria-label="高级配置"><button className="advanced-toggle" aria-expanded={tab !== 'basic'} onClick={() => setTab(tab === 'basic' ? 'agents' : 'basic')}>高级设置<Icon name="settings"/></button>{tabs.map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} aria-expanded={tab === id} onClick={() => setTab(tab === id ? 'basic' : id)}>{label}<Icon name="chevron"/></button>)}</div>
    {tab !== 'basic' && <div className="editor-body panel">
      {tab === 'agents' && <><div className="editor-head"><div><span className="eyebrow">AGENT SPECS</span><h3>Agent 定义</h3><p>为每个角色设定身份、性格与背景，运行时作为模型决策输入。</p></div><button className="text-button" disabled={form.example === 'prisoners_dilemma' || form.agents.length >= 30} onClick={addAgent}>＋ 添加 Agent</button></div>{form.agents.map((agent, index) => <div className="card" key={index}><div className="card-head"><b>{String(index + 1).padStart(2, '0')}　{agent.name}</b><button className="remove-button" disabled={form.agents.length <= 2 || form.example === 'prisoners_dilemma'} onClick={() => setForm(current => ({ ...current, agents: current.agents.filter((_, itemIndex) => itemIndex !== index) }))}>移除</button></div><div className="grid"><Field label="ID" type="number" value={agent.id} onChange={value => updateAgent(index, 'id', value)} /><Field label="姓名" value={agent.name} onChange={value => updateAgent(index, 'name', value)} /><Field label="年龄" type="number" value={agent.age} onChange={value => updateAgent(index, 'age', value)} /><Field label="性格" value={agent.personality} onChange={value => updateAgent(index, 'personality', value)} /></div><Field label="背景介绍" value={agent.bio} onChange={value => updateAgent(index, 'bio', value)} /></div>)}</>}
      {tab === 'environment' && <><div className="editor-head"><div><h3>环境定义</h3><p>设置博弈轮次和公共物品的初始金额、收益倍数。</p></div></div>{form.example === 'prisoners_dilemma' ? <p>囚徒困境为单轮博弈，没有额外环境参数。收益可在“环境规则”中调整。</p> : <div className="grid"><Field label="轮次" type="number" value={form.environment.rounds} onChange={value => updateEnvironment('rounds', value)} />{form.example === 'public_goods' && <><Field label="每人初始金额" type="number" value={form.environment.endowment} onChange={value => updateEnvironment('endowment', value)} /><Field label="公共资金倍数" type="number" value={form.environment.contribution_factor} onChange={value => updateEnvironment('contribution_factor', value)} /></>}</div>}</>}
      {tab === 'rules' && <><div className="editor-head"><div><span className="eyebrow">GAME RULES</span><h3>博弈规则</h3><p>按所选示例设置收益矩阵或声誉规范。</p></div></div>{form.example === 'prisoners_dilemma' && <div className="grid">{([['payoff_cc', '双方合作收益'], ['payoff_cd', '我合作对方背叛'], ['payoff_dc', '我背叛对方合作'], ['payoff_dd', '双方背叛收益']] as const).map(([key, label]) => <Field key={key} label={label} type="number" value={form.rules[key]} onChange={value => updateRule(key, value)} />)}</div>}{form.example === 'public_goods' && <p>每轮收益 = 未投入金额 + 公共资金按人数平分。可在“环境定义”调整参数。</p>}{form.example === 'reputation_game' && <><div className="grid"><Field label="合作给接收者的收益" type="number" value={form.rules.benefit} onChange={value => updateRule('benefit', value)} /><Field label="合作给捐赠者的成本" type="number" value={form.rules.cost} onChange={value => updateRule('cost', value)} /><Field label="随机种子" type="number" value={form.rules.seed} onChange={value => updateRule('seed', value)} /></div><label className="field"><span>社会规范</span><select value={form.rules.norm_type} onChange={event => updateRule('norm_type', event.target.value)}><option value="stern_judging">stern_judging</option><option value="simple_standing">simple_standing</option><option value="image_score">image_score</option></select></label></>}</>}
      {tab === 'skills' && <><div className="editor-head"><div><span className="eyebrow">CAPABILITIES</span><h3>Agent Skills 定义</h3><p>启用的技能会写入本次运行，并作为 Agent 的决策指令传给 LLM。</p></div><button className="text-button" onClick={addSkill}>＋ 添加 Skill</button></div>{form.skills.length === 0 && <div className="skills-empty"><Icon name="box"/><div><strong>还没有 Agent 技能</strong><p>添加技能，为 Agent 补充决策指令。</p></div></div>}{form.skills.map((skill, index) => <div className="card" key={index}><div className="card-head"><b>{skill.name || '未命名 Skill'}</b><button className="remove-button" onClick={() => setForm(current => ({ ...current, skills: current.skills.filter((_, itemIndex) => itemIndex !== index) }))}>移除</button></div><Field label="名称（英文小写、数字、连字符）" value={skill.name} onChange={value => updateSkill(index, 'name', value)} /><Field label="描述" value={skill.description} onChange={value => updateSkill(index, 'description', value)} /><label className="field"><span>技能指令（Markdown）</span><textarea value={skill.instructions} onChange={event => updateSkill(index, 'instructions', event.target.value)} /></label><label className="check"><input type="checkbox" checked={skill.enabled} onChange={event => updateSkill(index, 'enabled', event.target.checked)} /> 启用此技能</label></div>)}</>}
      {tab === 'env' && <><div className="editor-head"><div><span className="eyebrow">LOCAL SETTINGS</span><h3>模型连接设置</h3><p>配置本次实验使用的模型，API 密钥由本地服务保管。</p></div><span className="key-state">{env.api_key_configured ? '● 已配置' : '○ 未配置'}</span></div><Field label="API 密钥" type="password" placeholder="留空则保留原值" value={keyValue} onChange={setKeyValue} /><Field label="API 地址" value={env.api_base} onChange={value => setEnv(current => ({ ...current, api_base: value }))} /><Field label="模型名称" value={env.model} onChange={value => setEnv(current => ({ ...current, model: value }))} /><button className="secondary" disabled={busy} onClick={onSave}>保存模型配置</button>{saved && <span className="saved">已保存</span>}</>}
    </div>}
  </div>
}

function ConfigurationView({ form, setForm, name, setName, onChoose, onResults, tab, setTab, env, keyValue, setKeyValue, setEnv, busy, saved, onSave }: { form: Form; setForm: FormSetter; name: string; setName: (name: string) => void; onChoose: (example: Example) => void; onResults: () => void; tab: ConfigTab; setTab: (tab: ConfigTab) => void; env: EnvState; keyValue: string; setKeyValue: (value: string) => void; setEnv: Dispatch<SetStateAction<EnvState>>; busy: boolean; saved: boolean; onSave: () => void }) {
  const checks = [Boolean(name.trim()), form.agents.every(agent => agent.name.trim()) && new Set(form.agents.map(agent => agent.id)).size === form.agents.length && new Set(form.agents.map(agent => agent.name)).size === form.agents.length, form.environment.rounds >= 1 && form.environment.rounds <= 15, env.api_key_configured, Boolean(env.model.trim())]
  const completeness = Math.round(checks.filter(Boolean).length / checks.length * 100)
  const workflow: Array<{ title: string; tab?: ConfigTab; icon: IconName; description: string }> = [
    { title: '实验方案', tab: 'basic', icon: 'file', description: '选择研究主题，设置参与人数与仿真参数。' },
    { title: 'Agent 定义', tab: 'agents', icon: 'users', description: '设定每个 Agent 的身份、性格与背景，让决策更贴近研究情境。' },
    { title: '环境与规则', tab: 'rules', icon: 'network', description: '配置博弈收益和行为规则，明确 Agent 之间的互动方式。' },
    { title: '模型连接', tab: 'env', icon: 'box', description: '配置模型与 API 连接，准备运行仿真实验。' },
    { title: '结果分析', icon: 'chart', description: '查看仿真事件、Agent 决策与环境结算结果。' },
  ]
  const activeStep = tab === 'agents' || tab === 'skills' ? 1 : tab === 'environment' || tab === 'rules' ? 2 : tab === 'env' ? 3 : 0
  return <section className="workspace-view configuration-view">
    <div className="configuration-grid"><div className="configuration-main">
      <BasicConfiguration form={form} setForm={setForm} name={name} setName={setName} env={env} onChoose={onChoose} setTab={setTab}/>
      <ConfigEditor form={form} setForm={setForm} tab={tab} setTab={setTab} env={env} keyValue={keyValue} setKeyValue={setKeyValue} setEnv={setEnv} busy={busy} saved={saved} onSave={onSave} />
      <section className="workflow panel" aria-labelledby="workflow-title"><h2 id="workflow-title">仿真流程</h2><div className="workflow-steps">{workflow.map((step, index) => <button key={step.title} className={index === activeStep ? 'active' : ''} aria-current={index === activeStep ? 'step' : undefined} onClick={() => step.tab ? setTab(step.tab) : onResults()}><span className="step-number">{index + 1}</span><span>{step.title}</span></button>)}</div><div className="workflow-description"><span className="workflow-icon"><Icon name={workflow[activeStep].icon}/></span><div><strong>{workflow[activeStep].title}</strong><p>{workflow[activeStep].description}</p></div><button className="text-button" onClick={() => setTab(activeStep === 0 ? 'agents' : activeStep === 1 ? 'rules' : activeStep === 2 ? 'env' : 'basic')}>{activeStep === 3 ? '返回配置' : '下一步'}<Icon name="arrow"/></button></div></section>
      <div className="workspace-caption"><Icon name="network"/><span>AgentSociety · 社会科学仿真实验</span><span>配置、运行、观察与分析</span></div>
    </div><aside className="run-rail panel">
      <div className="rail-top"><h2><Icon name="chart"/>运行概览</h2><p>本次实验预计配置</p></div>
      <dl className="rail-summary"><div><span className="summary-icon"><Icon name="users"/></span><div><dt>Agent 数</dt><dd>{form.agents.length.toLocaleString()}</dd></div></div><div><span className="summary-icon"><Icon name="clock"/></span><div><dt>仿真轮次</dt><dd>{form.example === 'prisoners_dilemma' ? 1 : form.environment.rounds}</dd></div></div><div><span className="summary-icon"><Icon name="box"/></span><div><dt>运行模型</dt><dd className="model-value">{env.model || '待配置'}</dd></div></div><div><span className="summary-icon"><Icon name="flag"/></span><div><dt>当前状态</dt><dd><span className="badge blue">{busy ? '运行中' : '草稿'}</span></dd></div></div></dl>
      <div className="completeness"><h3>配置完整度<span className="info-mark" title="检查实验名称、Agent、仿真轮次、API 密钥和模型名称">i</span></h3><strong>{completeness}<span>%</span></strong><div className="progress-track" role="progressbar" aria-label="配置完整度" aria-valuenow={completeness} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${completeness}%` }}/></div><p>{completeness === 100 ? '基础配置已就绪，可以运行仿真。' : '完善参数配置以准备本次实验。'}</p>{(!env.api_key_configured || !env.model) && <button className="text-button" onClick={() => setTab('env')}>配置模型连接<Icon name="arrow"/></button>}</div>
      <div className="rail-bottom"><Icon name="check"/><span>运行结果与输入快照自动保存</span></div>
    </aside></div>
  </section>
}

function ResultsView({ run, onConfigure, readOnly = false }: { run: Run | null; onConfigure: () => void; readOnly?: boolean }) {
  return <section className="workspace-view results-view">
    <div className="view-intro"><div><h1>实验结果</h1><p>按执行顺序查看模型决策、环境结算和输入快照。</p></div>{!readOnly && <button className="outline-button" onClick={onConfigure}>返回配置</button>}</div>
    {run ? <div className="result-shell">
      <div className="result-hero"><div><span className="result-label">当前记录</span><h2>{titles[run.example] || run.example}</h2><p>{new Date(run.created_at).toLocaleString('zh-CN')}　/　{run.id.slice(0, 8)}</p></div><span className={`completed-badge ${run.status === 'completed' ? 'completed' : 'failed'}`}>{run.status === 'completed' ? '已完成' : '未完成'}</span></div>
      {run.error && <div className="error" role="alert"><b>运行未完成</b><span>{run.error}</span></div>}
      <dl className="stats"><div><dt>执行步骤</dt><dd>{run.events.length}</dd></div><div><dt>参与者</dt><dd>{run.inputs.agents.length}</dd></div><div><dt>运行模型</dt><dd>{run.model || '离线历史记录'}</dd></div></dl>
      <div className="timeline-heading"><h3>事件记录</h3><span>共 {run.events.length} 步</span></div>
      <div className="timeline">{run.events.map(event => <div className="event" key={event.step}><span>{String(event.step).padStart(2, '0')}</span><div><b>{event.action}</b><pre>{JSON.stringify(event.result, null, 2)}</pre></div></div>)}</div>
      <details className="snapshot"><summary>查看输入快照</summary><pre>{JSON.stringify(run.inputs, null, 2)}</pre></details>
    </div> : <div className="empty-result"><span className="empty-mark" aria-hidden="true">◯</span><h2>还没有实验结果</h2><p>配置并运行一次实验后，这里会显示完整的事件记录。</p><button className="secondary" onClick={onConfigure}>配置实验</button></div>}
  </section>
}

export default function App() {
  const [draft] = useState(readDraft)
  const [form, setForm] = useState<Form>(() => draft?.form || createInitialForm())
  const [name, setName] = useState(() => draft?.name || '囚徒困境实验')
  const [draftSavedAt, setDraftSavedAt] = useState(draft?.savedAt || '')
  const [savedDraft, setSavedDraft] = useState(() => draft ? JSON.stringify({ name: draft.name, form: draft.form }) : '')
  const [tab, setTab] = useState<ConfigTab>('basic')
  const [view, setView] = useState<View>('configuration')
  const [run, setRun] = useState<Run | null>(null)
  const [history, setHistory] = useState<RunSummary[]>([])
  const [env, setEnv] = useState<EnvState>({ api_key_configured: false, api_base: '', model: '' })
  const [savedEnv, setSavedEnv] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [readOnly, setReadOnly] = useState(false)
  const [configLoading, setConfigLoading] = useState(true)

  const refresh = () => api<RunSummary[]>('/api/runs').then(setHistory).catch(error => setError(errorMessage(error)))
  useEffect(() => {
    Promise.all([api<RunSummary[]>('/api/runs'), api<{ env: EnvState; read_only?: boolean }>('/api/config')]).then(async ([runs, value]) => {
      setHistory(runs); setEnv(value.env); setSavedEnv(JSON.stringify(value.env)); setReadOnly(Boolean(value.read_only))
      if (value.read_only && runs.length) {
        setView('results'); setHistoryLoading(true)
        const selected = runs.find(item => item.example === 'public_goods') || runs[0]
        try { setRun(await api<Run>(`/api/runs/${selected.id}`)) } finally { setHistoryLoading(false) }
      }
    }).catch(error => setError(errorMessage(error))).finally(() => setConfigLoading(false))
  }, [])
  const newExperiment = () => { setForm(createInitialForm()); setName('未命名实验'); setTab('basic'); setRun(null); setError(''); setSaved(false); setView('configuration') }
  const choose = (example: Example) => {
    setForm(current => ({ ...current, example, agents: resizeAgents(current, example === 'prisoners_dilemma' ? 2 : example === 'public_goods' ? 4 : 10) }))
    setName(current => current === `${titles[form.example]}实验` || current === '未命名实验' ? `${titles[example]}实验` : current)
    setView('configuration')
  }
  const openSettings = (nextTab: ConfigTab) => { setView('configuration'); setTab(nextTab) }
  const saveDraft = () => {
    try {
      const savedAt = new Date().toISOString()
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ name, form, savedAt }))
      setSavedDraft(JSON.stringify({ name, form })); setDraftSavedAt(savedAt); setError('')
    } catch { setError('草稿保存失败，请检查浏览器是否允许本地存储。') }
  }
  const start = async () => {
    if (keyValue || savedEnv !== JSON.stringify(env)) { setError('模型连接有未保存的修改，请先保存模型配置。'); openSettings('env'); return }
    if (!env.api_key_configured || !env.model.trim()) { setError('请先配置 API 密钥与模型名称，再运行仿真。'); openSettings('env'); return }
    if (!name.trim()) { setError('请填写实验名称。'); openSettings('basic'); return }
    setBusy(true); setError(''); setRun(null)
    try { setRun(await api<Run>('/api/runs', form)); await refresh(); setView('results') }
    catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  const save = async () => { setBusy(true); setError(''); setSaved(false); try { const value = await api<{ env: EnvState }>('/api/config', { ...(keyValue ? { api_key: keyValue } : {}), api_base: env.api_base, model: env.model }); setEnv(value.env); setSavedEnv(JSON.stringify(value.env)); setKeyValue(''); setSaved(true) } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) } }
  const openRun = async (id: string) => { setError(''); setRun(null); setHistoryLoading(true); setView('results'); try { setRun(await api<Run>(`/api/runs/${id}`)) } catch (error) { setError(errorMessage(error)) } finally { setHistoryLoading(false) } }
  const draftDirty = savedDraft !== JSON.stringify({ name, form })

  if (configLoading) return <main className="loading-result panel" role="status">正在加载实验台…</main>
  if (readOnly) return <div className="shell"><aside className="sidebar">
    <div className="brand"><Icon name="network" className="logo"/><div><strong>社科试验台</strong><small>Social Science Simulation Lab</small></div></div>
    <div className="side-label">成功实例 · {history.length} 个</div>
    <nav className="history showcase-history" aria-label="成功实验记录">{history.map(item => <button key={item.id} className={run?.id === item.id ? 'active' : ''} onClick={() => openRun(item.id)}><span>{titles[item.example] || ({ hello_agent: 'Hello Agent', custom_env: '自定义环境', replay_system: '回放系统' } as Record<string, string>)[item.example] || item.example}<i className="run-dot success"/></span><small>{new Date(item.created_at).toLocaleString('zh-CN')} · {item.id.slice(0, 6)}</small></button>)}</nav>
    <div className="side-foot"><span className="status-dot"/>公开展示 · 只读</div>
  </aside><main><header className="workspace-header"><div className="breadcrumb"><h1>成功实例展示</h1></div><a className="outline-button" href="https://github.com/lx963/society-lab" target="_blank" rel="noreferrer">查看源码</a></header><div className="page">
    <p className="basic-note">公开浏览已完成的真实 LLM 博弈与离线历史示例。模型配置和新建实验已关闭。</p>
    {error && <div className="error global-error" role="alert">{error}</div>}
    {historyLoading ? <div className="loading-result panel" role="status">正在加载实验记录…</div> : run ? <ResultsView run={run} readOnly onConfigure={() => {}}/> : <p role="status">暂无可展示的实验记录。</p>}
  </div></main></div>

  return <div className="shell"><Sidebar view={view} form={form} name={name} busy={busy} run={run} history={history} onNew={newExperiment} onView={setView} onChoose={choose} onSettings={openSettings} onOpenRun={openRun}/><main><header className="workspace-header"><div className="breadcrumb"><h1>工作台</h1><span className="breadcrumb-divider"/><span>{view === 'configuration' ? name || '未命名实验' : '实验结果'}</span></div><div className="header-actions"><button className="outline-button" disabled={busy || view === 'results'} onClick={saveDraft}><Icon name="file"/>保存草稿</button><button className="primary-button" disabled={busy || view === 'results'} onClick={start}><Icon name="play"/>{busy ? '正在仿真…' : '运行仿真'}</button></div></header><div className="page"><div className="workspace-meta"><Icon name={view === 'configuration' ? 'file' : 'chart'}/><span>{view === 'configuration' ? '草稿' : '实验记录'}</span><span className="save-status" role="status">{view === 'configuration' ? draftSavedAt ? draftDirty ? '有未保存的修改' : `最近保存于 ${new Date(draftSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '尚未保存' : '查看决策与仿真结果'}</span><span className="online"><span className="status-dot"/>本地工作空间</span></div>{error && <div className="error global-error" role="alert"><b>操作未完成</b><span>{error}</span><button className="text-button" onClick={() => setError('')}>关闭提示</button></div>}{view === 'configuration' ? <fieldset className="workspace-controls" disabled={busy}><ConfigurationView form={form} setForm={setForm} name={name} setName={setName} onChoose={choose} onResults={() => setView('results')} tab={tab} setTab={setTab} env={env} keyValue={keyValue} setKeyValue={value => { setKeyValue(value); setSaved(false) }} setEnv={value => { setEnv(value); setSaved(false) }} busy={busy} saved={saved} onSave={save}/></fieldset> : historyLoading ? <div className="loading-result panel" role="status">正在加载实验记录…</div> : <ResultsView run={run} onConfigure={() => setView('configuration')}/>}</div></main></div>
}
