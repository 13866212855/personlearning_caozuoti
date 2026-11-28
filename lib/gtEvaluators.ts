import type {
  CircuitComponent,
  CircuitState,
  StructureMember,
  StructureState,
} from './types';

function normPin(pin: string): string {
  return pin.trim().toLowerCase();
}

function parseThreshold(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const m = value.match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : fallback;
}

export function isSensorConducting(
  comp: CircuitComponent,
  lightLevel = 50,
  tempC = 25
): boolean {
  const val = (comp.value || '').toLowerCase();
  if (comp.type === 'switch') {
    return comp.closed !== false;
  }
  if (comp.type === 'resistor') {
    return true;
  }
  if (comp.type === 'sensor_light') {
    const th = parseThreshold(comp.value, 40);
    if (val.includes('bright') || val.includes('>') || val.includes('亮')) {
      return lightLevel >= th;
    }
    return lightLevel <= th;
  }
  if (comp.type === 'sensor_temp') {
    const th = parseThreshold(comp.value, 35);
    if (val.includes('<') || val.includes('low') || val.includes('低')) {
      return tempC <= th;
    }
    return tempC >= th;
  }
  return false;
}

function buildWireAdj(state: CircuitState): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const addEdge = (u: string, v: string) => {
    if (!adj.has(u)) adj.set(u, new Set());
    if (!adj.has(v)) adj.set(v, new Set());
    adj.get(u)!.add(v);
    adj.get(v)!.add(u);
  };
  for (const w of state.wires || []) {
    if (!w?.from || !w?.to) continue;
    const u = normPin(w.from);
    const v = normPin(w.to);
    if (u && v && u !== v) addEdge(u, v);
  }
  return adj;
}

function bfsReachable(
  startPins: string[],
  adj: Map<string, Set<string>>
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const s of startPins) {
    const k = normPin(s);
    if (!visited.has(k)) {
      visited.add(k);
      queue.push(k);
    }
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const neighbors = adj.get(cur);
    if (!neighbors) continue;
    for (const nxt of neighbors) {
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return visited;
}

export function areWirePinsConnected(
  state: CircuitState,
  pinA: string,
  pinB: string
): boolean {
  const a = normPin(pinA);
  const b = normPin(pinB);
  if (a === b) return true;
  const adj = buildWireAdj(state);
  // Check both wire connectivity and passive switch/resistor continuity if desired,
  // or pure wire topology. Pure wire topology matches explicit "wire_connected" checkpoints,
  // while multi-hop through a single closed component pin pair also works naturally if wires connect directly.
  const reachable = bfsReachable([a], adj);
  return reachable.has(b);
}

export interface CircuitEvalResult {
  powered: boolean;
  activeOutputs: Record<string, boolean>;
  activeComponentIds: string[];
  energizedRelays: string[];
  conductingSensors: string[];
  shortCircuit: boolean;
  summary: string;
}

export function evaluateCircuit(state: CircuitState): CircuitEvalResult {
  const comps = state.components || [];
  const powered = Boolean(state.powered);
  const lightLevel = state.lightLevel ?? 50;
  const tempC = state.tempC ?? 25;

  const conductingSensors: string[] = [];
  for (const c of comps) {
    if (
      (c.type === 'sensor_light' || c.type === 'sensor_temp' || c.type === 'switch') &&
      isSensorConducting(c, lightLevel, tempC)
    ) {
      conductingSensors.push(c.id);
    }
  }

  if (!powered) {
    return {
      powered: false,
      activeOutputs: {},
      activeComponentIds: [],
      energizedRelays: [],
      conductingSensors,
      shortCircuit: false,
      summary: '电源总开关尚未开启，电路处于断电状态。',
    };
  }

  const vccPins: string[] = [];
  const gndPins: string[] = [];
  for (const c of comps) {
    if (c.type === 'vcc') {
      for (const p of c.pins || ['out']) vccPins.push(`${c.id}.${p}`);
    } else if (c.type === 'gnd') {
      for (const p of c.pins || ['in']) gndPins.push(`${c.id}.${p}`);
    }
  }

  const energizedRelays = new Set<string>();
  const conductingTransistors = new Set<string>();

  const buildConductiveGraph = (excludeLoadId?: string): Map<string, Set<string>> => {
    const adj = buildWireAdj(state);
    const link = (u: string, v: string) => {
      const nu = normPin(u);
      const nv = normPin(v);
      if (!adj.has(nu)) adj.set(nu, new Set());
      if (!adj.has(nv)) adj.set(nv, new Set());
      adj.get(nu)!.add(nv);
      adj.get(nv)!.add(nu);
    };

    for (const c of comps) {
      if (c.id === excludeLoadId) continue;
      const pins = c.pins || [];
      if (
        c.type === 'resistor' ||
        c.type === 'switch' ||
        c.type === 'sensor_light' ||
        c.type === 'sensor_temp'
      ) {
        if (pins.length >= 2 && isSensorConducting(c, lightLevel, tempC)) {
          link(`${c.id}.${pins[0]}`, `${c.id}.${pins[1]}`);
        }
      } else if (c.type === 'transistor_npn') {
        if (conductingTransistors.has(c.id)) {
          const cPin = pins.find((p) => p.toLowerCase() === 'c') || pins[1];
          const ePin = pins.find((p) => p.toLowerCase() === 'e') || pins[2];
          if (cPin && ePin) link(`${c.id}.${cPin}`, `${c.id}.${ePin}`);
        }
      } else if (c.type === 'relay') {
        if (energizedRelays.has(c.id)) {
          const comPin = pins.find((p) => p.toLowerCase() === 'com') || pins[2];
          const noPin = pins.find((p) => p.toLowerCase() === 'no') || pins[3];
          if (comPin && noPin) link(`${c.id}.${comPin}`, `${c.id}.${noPin}`);
        }
      }
    }
    return adj;
  };

  // Iterative fixed-point propagation for transistors & relays
  for (let iter = 0; iter < 6; iter++) {
    let changed = false;
    const adjNoLoads = buildConductiveGraph();
    const fromVcc = bfsReachable(vccPins, adjNoLoads);
    const fromGnd = bfsReachable(gndPins, adjNoLoads);

    for (const c of comps) {
      const pins = c.pins || [];
      if (c.type === 'transistor_npn') {
        const bPin = pins.find((p) => p.toLowerCase() === 'b') || pins[0];
        const ePin = pins.find((p) => p.toLowerCase() === 'e') || pins[2];
        if (bPin && ePin) {
          const bOn = fromVcc.has(normPin(`${c.id}.${bPin}`));
          const eGrounded = fromGnd.has(normPin(`${c.id}.${ePin}`));
          if (bOn && eGrounded && !conductingTransistors.has(c.id)) {
            conductingTransistors.add(c.id);
            changed = true;
          }
        }
      } else if (c.type === 'relay') {
        const p0 = pins[0];
        const p1 = pins[1];
        if (p0 && p1) {
          const k0 = normPin(`${c.id}.${p0}`);
          const k1 = normPin(`${c.id}.${p1}`);
          const loop =
            (fromVcc.has(k0) && fromGnd.has(k1)) ||
            (fromVcc.has(k1) && fromGnd.has(k0));
          if (loop && !energizedRelays.has(c.id)) {
            energizedRelays.add(c.id);
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }

  const baseAdj = buildConductiveGraph();
  const baseFromVcc = bfsReachable(vccPins, baseAdj);
  const shortCircuit = gndPins.some((gp) => baseFromVcc.has(normPin(gp)));

  const activeOutputs: Record<string, boolean> = {};
  const activeComponentIds: string[] = [];

  for (const c of comps) {
    if (c.type !== 'led' && c.type !== 'buzzer') continue;
    const pins = c.pins || ['a', 'b'];
    if (pins.length < 2) continue;
    const adjExcl = buildConductiveGraph(c.id);
    const fromVcc = bfsReachable(vccPins, adjExcl);
    const fromGnd = bfsReachable(gndPins, adjExcl);
    const p0 = normPin(`${c.id}.${pins[0]}`);
    const p1 = normPin(`${c.id}.${pins[1]}`);
    const isActive =
      !shortCircuit &&
      ((fromVcc.has(p0) && fromGnd.has(p1)) ||
        (fromVcc.has(p1) && fromGnd.has(p0)));
    activeOutputs[c.id] = isActive;
    if (isActive) activeComponentIds.push(c.id);
  }

  for (const rId of energizedRelays) {
    activeOutputs[rId] = true;
    activeComponentIds.push(rId);
  }

  let summary = '电源已接通，但输出负载暂未形成有效工作回路。';
  if (shortCircuit) {
    summary = '警告：检测到 VCC 与 GND 直接短接，请检查导线连接！';
  } else if (activeComponentIds.length > 0) {
    const names = comps
      .filter((c) => activeComponentIds.includes(c.id))
      .map((c) => c.label);
    summary = `回路工作正常，当前激活器件：${names.join('、')}。`;
  }

  return {
    powered,
    activeOutputs,
    activeComponentIds,
    energizedRelays: Array.from(energizedRelays),
    conductingSensors,
    shortCircuit,
    summary,
  };
}

export interface StructureEvalResult {
  totalMembers: number;
  triangleCount: number;
  maxSafeLoadN: number;
  safetyFactor: number;
  isStable: boolean;
  stabilityScore: number; // 0 - 100
  summary: string;
}

function memberKey(a: string, b: string): string {
  return a < b ? `${a}__${b}` : `${b}__${a}`;
}

export function evaluateStructure(state: StructureState): StructureEvalResult {
  const nodes = state.nodes || [];
  const allMembers: StructureMember[] = [
    ...(state.baseMembers || []),
    ...(state.members || []),
  ];

  const edgeMap = new Map<string, StructureMember>();
  for (const m of allMembers) {
    if (!m.from || !m.to || m.from === m.to) continue;
    edgeMap.set(memberKey(m.from, m.to), m);
  }

  const adj = new Map<string, Set<string>>();
  for (const m of edgeMap.values()) {
    if (!adj.has(m.from)) adj.set(m.from, new Set());
    if (!adj.has(m.to)) adj.set(m.to, new Set());
    adj.get(m.from)!.add(m.to);
    adj.get(m.to)!.add(m.from);
  }

  const nodeIds = nodes.map((n) => n.id);
  let triangleCount = 0;
  for (let i = 0; i < nodeIds.length; i++) {
    for (let j = i + 1; j < nodeIds.length; j++) {
      if (!adj.get(nodeIds[i])?.has(nodeIds[j])) continue;
      for (let k = j + 1; k < nodeIds.length; k++) {
        if (
          adj.get(nodeIds[i])?.has(nodeIds[k]) &&
          adj.get(nodeIds[j])?.has(nodeIds[k])
        ) {
          triangleCount++;
        }
      }
    }
  }

  const matWeight: Record<StructureMember['material'], number> = {
    wood: 1.0,
    aluminum: 1.35,
    steel: 1.8,
  };
  let avgMat = 1.0;
  if (edgeMap.size > 0) {
    let sum = 0;
    for (const m of edgeMap.values()) {
      sum += matWeight[m.material] || 1.0;
    }
    avgMat = sum / edgeMap.size;
  }

  const jointFactor = state.jointType === 'rigid' ? 1.35 : 0.9;
  const baseWidth = Math.max(20, Number(state.supportBaseWidth || 100));
  const widthFactor = Math.min(1.6, Math.max(0.6, baseWidth / 120));

  // Unbraced hinged frames cannot resist lateral/vertical load safely
  const baseCapacity =
    triangleCount > 0
      ? 140 + triangleCount * 110
      : state.jointType === 'rigid'
        ? 110
        : 45;

  const maxSafeLoadN = Math.round(
    baseCapacity * avgMat * jointFactor * widthFactor
  );
  const testLoad = Math.max(10, Number(state.testLoadN || 100));
  const safetyFactor = Number((maxSafeLoadN / testLoad).toFixed(2));
  const hasGeometryRigidity = triangleCount >= 1 || state.jointType === 'rigid';
  const isStable = safetyFactor >= 1.0 && hasGeometryRigidity && edgeMap.size >= 3;
  const stabilityScore = Math.max(
    0,
    Math.min(100, Math.round(safetyFactor * 65 + triangleCount * 10))
  );

  let summary = '';
  if (!hasGeometryRigidity) {
    summary = '警告：当前结构缺少三角形斜撑且采用铰连接，受压易发生失稳变形！';
  } else if (!isStable) {
    summary = `当前最大安全承载力约 ${maxSafeLoadN} N，低于测试载荷 ${testLoad} N，需增加斜撑、加宽支撑面或升级材料/刚连接。`;
  } else {
    summary = `结构稳定可靠：形成 ${triangleCount} 个稳定三角形，最大安全承载力 ${maxSafeLoadN} N（安全系数 ${safetyFactor}）。`;
  }

  return {
    totalMembers: edgeMap.size,
    triangleCount,
    maxSafeLoadN,
    safetyFactor,
    isStable,
    stabilityScore,
    summary,
  };
}
