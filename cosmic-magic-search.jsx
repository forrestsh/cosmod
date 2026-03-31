import { useState, useCallback, useRef } from "react";

// ============================================================
// Cosmic Grid Signal Model
// Each cell has 4 output bits: [ox+, oy+, ox-, oy-]
// Packed as: bit3=ox+, bit2=oy+, bit1=ox-, bit0=oy-
//
// Inputs to node (i,j):
//   ix+ = ox- of neighbor (i, j+1)  [right neighbor's ox-]
//   iy+ = oy- of neighbor (i+1, j)  [bottom neighbor's oy-]
//   ix- = ox+ of neighbor (i, j-1)  [left neighbor's ox+]
//   iy- = oy+ of neighbor (i-1, j)  [top neighbor's oy+]
//
// Linear rule: 4x4 GF(2) matrix
//   output[k] = XOR of rule[k][b] * input[b], b in {ix+,iy+,ix-,iy-}
// ============================================================

const N = 4;
const RULE_FILE_VERSION = 1;
const RULE_FILE_MODEL = "cosmic-grid-4x4";

// Initial condition: cell(i,j) output = (i<<2)|j
// ox+ = i>>1, oy+ = i&1, ox- = j>>1, oy- = j&1
function makeInitGrid() {
  return Array.from({length:N}, (_,i) =>
    Array.from({length:N}, (_,j) => (i<<2)|j)
  );
}

// Extract individual output bits from packed cell value
// bit3=ox+, bit2=oy+, bit1=ox-, bit0=oy-
const getOxPlus  = v => (v>>3)&1;
const getOyPlus  = v => (v>>2)&1;
const getOxMinus = v => (v>>1)&1;
const getOyMinus = v => (v>>0)&1;

// Apply linear rule (4x4 GF2 matrix) to 4-bit input array
function applyRule(rule, inp) {
  // inp: [ix+, iy+, ix-, iy-] each 0 or 1
  // returns [ox+, oy+, ox-, oy-]
  return rule.map(row => row.reduce((s,r,b) => s ^ (r & inp[b]), 0));
}

// Evolve one step (toroidal)
function evolveGrid(grid, rule) {
  return Array.from({length:N}, (_,i) =>
    Array.from({length:N}, (_,j) => {
      // ix+ comes from right neighbor's ox-
      const right  = grid[i][(j+1)%N];
      // iy+ comes from bottom neighbor's oy-
      const bottom = grid[(i+1)%N][j];
      // ix- comes from left neighbor's ox+
      const left   = grid[i][(j-1+N)%N];
      // iy- comes from top neighbor's oy+
      const top    = grid[(i-1+N)%N][j];

      const inp = [
        getOxMinus(right),   // ix+
        getOyMinus(bottom),  // iy+
        getOxPlus(left),     // ix-
        getOyPlus(top),      // iy-
      ];
      const [oxp, oyp, oxm, oym] = applyRule(rule, inp);
      return (oxp<<3)|(oyp<<2)|(oxm<<1)|oym;
    })
  );
}

// Check magic square (values 0..15, magic sum = 30)
function isMagicSquare(grid) {
  const flat = grid.flat();
  if (new Set(flat).size !== 16) return false;
  const T = 30;
  for(let i=0;i<N;i++) if(grid[i].reduce((s,v)=>s+v,0)!==T) return false;
  for(let j=0;j<N;j++){let s=0;for(let i=0;i<N;i++)s+=grid[i][j];if(s!==T)return false;}
  let d1=0,d2=0;
  for(let i=0;i<N;i++){d1+=grid[i][i];d2+=grid[i][N-1-i];}
  return d1===T && d2===T;
}

// Check latin square (each value 0..3 appears once per row and col) for either hi or lo 2 bits
function isLatinSquare(grid, shift) {
  for(let i=0;i<N;i++){
    const row=new Set(grid[i].map(v=>(v>>shift)&3));
    if(row.size!==N) return false;
  }
  for(let j=0;j<N;j++){
    const col=new Set(grid.map(row=>(row[j]>>shift)&3));
    if(col.size!==N) return false;
  }
  return true;
}

// Decode rule int -> 4x4 matrix
function ruleIntToMatrix(ruleInt) {
  return Array.from({length:4}, (_,k) =>
    Array.from({length:4}, (_,b) => (ruleInt>>(k*4+b))&1)
  );
}

function ruleIntToGrid4x4RuleTable(ruleInt) {
  const matrix = ruleIntToMatrix(ruleInt);
  return Array.from({ length: 16 }, (_, gridIndex) => {
    // 4x4 model index order: [left ox+, top oy+, right ox-, bottom oy-]
    const leftOxPlus = (gridIndex >> 3) & 1;
    const topOyPlus = (gridIndex >> 2) & 1;
    const rightOxMinus = (gridIndex >> 1) & 1;
    const bottomOyMinus = gridIndex & 1;
    // magic-search matrix order: [right ox-, bottom oy-, left ox+, top oy+]
    const inp = [rightOxMinus, bottomOyMinus, leftOxPlus, topOyPlus];
    const [oxp, oyp, oxm, oym] = applyRule(matrix, inp);
    return (oxp << 3) | (oyp << 2) | (oxm << 1) | oym;
  });
}

// ============================================================
// UI Components
// ============================================================

const BIT_COLORS = ['#ef4444','#f97316','#22c55e','#3b82f6']; // ox+,oy+,ox-,oy-
const CELL_COLORS = [
  '#7f1d1d','#92400e','#3f6212','#164e63',
  '#1e1b4b','#4a044e','#881337','#713f12',
  '#14532d','#0c4a6e','#312e81','#4c1d95',
  '#500724','#431407','#052e16','#1e3a5f',
];

function CellGrid({grid, label, highlight=false}) {
  return (
    <div style={{textAlign:'center'}}>
      {label && <div style={{fontSize:11,color:'#888',marginBottom:4}}>{label}</div>}
      <div style={{
        display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:2,
        border: highlight ? '2px solid #34d399' : '2px solid transparent',
        borderRadius:6, padding:2
      }}>
        {grid.flat().map((v,idx)=>(
          <div key={idx} style={{
            background: CELL_COLORS[v] || '#1a1a2e',
            width:38,height:38,
            display:'flex',alignItems:'center',justifyContent:'center',
            borderRadius:4,flexDirection:'column',gap:1
          }}>
            <span style={{fontSize:13,fontWeight:'bold',color:'white'}}>{v+1}</span>
            <span style={{fontSize:9,color:'#aaa',letterSpacing:1}}>
              {[(v>>3)&1,(v>>2)&1,(v>>1)&1,v&1].join('')}
            </span>
          </div>
        ))}
      </div>
      {highlight && <div style={{fontSize:11,color:'#34d399',marginTop:3}}>✓ 幻方</div>}
    </div>
  );
}

function RuleMatrix({ruleInt}) {
  const rule = ruleIntToMatrix(ruleInt);
  const inLabels  = ['ix₊','iy₊','ix₋','iy₋'];
  const outLabels = ['ox₊','oy₊','ox₋','oy₋'];
  return (
    <div>
      <table style={{borderCollapse:'collapse',fontSize:12}}>
        <thead>
          <tr>
            <th style={{padding:'3px 8px',color:'#666'}}></th>
            {inLabels.map((l,b)=>(
              <th key={b} style={{padding:'3px 8px',color:'#60a5fa'}}>{l}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rule.map((row,k)=>(
            <tr key={k}>
              <td style={{padding:'3px 8px',color: BIT_COLORS[k],fontWeight:'bold'}}>
                {outLabels[k]}
              </td>
              {row.map((v,b)=>(
                <td key={b} style={{
                  padding:'3px 8px',textAlign:'center',
                  background: v ? '#1e3a5f' : '#111',
                  color: v ? '#60a5fa' : '#333',
                  border:'1px solid #222',
                  fontWeight: v ? 'bold' : 'normal'
                }}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{fontSize:10,color:'#555',marginTop:4}}>
        输出位 = 各输入位的 XOR 线性组合（GF₂）
      </div>
    </div>
  );
}

function EvolutionTrace({ruleInt, steps}) {
  const rule = ruleIntToMatrix(ruleInt);
  const init = makeInitGrid();
  const trace = [init];
  let g = init;
  for(let s=0;s<steps;s++){g=evolveGrid(g,rule);trace.push(g);}
  return (
    <div style={{overflowX:'auto',paddingBottom:8}}>
      <div style={{display:'flex',gap:16,alignItems:'flex-start',minWidth:'max-content'}}>
        {trace.map((gr,s)=>(
          <CellGrid key={s} grid={gr}
            label={s===0?'初始':s===steps?`第${s}步 ✓`:`第${s}步`}
            highlight={s===steps}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export default function CosmicMagicSearch() {
  const [maxSteps, setMaxSteps] = useState(8);
  const [results, setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [selected, setSelected]   = useState(null);
  const cancelRef = useRef(false);

  const exportResultAsJson = useCallback((result) => {
    if (!result) return;
    const payload = {
      version: RULE_FILE_VERSION,
      model: RULE_FILE_MODEL,
      source: "cosmic-magic-search",
      ruleEncoding: "cosmic-grid-4x4-step-index",
      savedAt: new Date().toISOString(),
      initialValues: makeInitGrid(),
      rule: ruleIntToGrid4x4RuleTable(result.ruleInt),
      ruleInt: result.ruleInt,
      stepFound: result.step,
      expectedMagicGrid: result.grid.map((row) => [...row]),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `cosmic-grid-4x4-magic-rule-${result.ruleInt}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const runSearch = useCallback(async () => {
    setSearching(true);
    setResults([]);
    setProgress(0);
    setSelected(null);
    cancelRef.current = false;
    const found = [];
    const init = makeInitGrid();
    const TOTAL = 65536, BATCH = 256;

    for(let base=0; base<TOTAL; base+=BATCH) {
      if(cancelRef.current) break;
      for(let r=base; r<Math.min(base+BATCH,TOTAL); r++) {
        const rule = ruleIntToMatrix(r);
        let grid = init.map(row=>[...row]);
        for(let step=1; step<=maxSteps; step++) {
          grid = evolveGrid(grid, rule);
          if(isMagicSquare(grid)) {
            const hiLatin = isLatinSquare(grid,2);
            const loLatin = isLatinSquare(grid,0);
            found.push({ruleInt:r, step, grid:grid.map(r=>[...r]), hiLatin, loLatin});
            break;
          }
        }
      }
      setProgress(Math.min(base+BATCH,TOTAL));
      if(found.length !== results.length) setResults([...found]);
      await new Promise(res=>setTimeout(res,0));
    }
    setResults([...found]);
    setSearching(false);
  }, [maxSteps]);

  const stopSearch = () => { cancelRef.current = true; };

  return (
    <div style={{
      background:'#0a0a14',color:'#e2e8f0',
      minHeight:'100vh',padding:20,fontFamily:'monospace'
    }}>
      <h2 style={{color:'#a78bfa',marginBottom:2}}>
        Cosmic Grid → 幻方 规则搜索
      </h2>
      <p style={{color:'#666',fontSize:12,marginBottom:4}}>
        输出信号 [ox₊ oy₊ ox₋ oy₋] = 4位值 · 初始值 cell(i,j) = (i&lt;&lt;2)|j
      </p>
      <p style={{color:'#555',fontSize:11,marginBottom:16}}>
        ix₊ ← 右邻居ox₋ · iy₊ ← 下邻居oy₋ · ix₋ ← 左邻居ox₊ · iy₋ ← 上邻居oy₊ · 搜索线性规则 2¹⁶=65536种
      </p>

      {/* Initial grid */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:12,color:'#888',marginBottom:8}}>初始条件（对角编码）</div>
        <CellGrid grid={makeInitGrid()} />
        <div style={{fontSize:11,color:'#555',marginTop:6}}>
          cell(i,j) = (i&lt;&lt;2)|j · 数值显示为十进制+1 · 下方4位为 ox₊oy₊ox₋oy₋
        </div>
      </div>

      {/* Controls */}
      <div style={{
        background:'#111120',borderRadius:8,padding:16,
        marginBottom:16,display:'flex',gap:24,flexWrap:'wrap',alignItems:'center'
      }}>
        <div>
          <div style={{fontSize:12,color:'#888',marginBottom:6}}>
            最大演化步数: <span style={{color:'#a78bfa'}}>{maxSteps}</span>
          </div>
          <input type="range" min={1} max={16} value={maxSteps}
            onChange={e=>setMaxSteps(Number(e.target.value))}
            style={{width:140}}
          />
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={runSearch} disabled={searching} style={{
            background: searching?'#222':'#7c3aed',
            color:'white',border:'none',borderRadius:6,
            padding:'8px 20px',cursor:searching?'not-allowed':'pointer',
            fontSize:14,fontWeight:'bold'
          }}>
            {searching ? '搜索中…' : '开始搜索'}
          </button>
          {searching && (
            <button onClick={stopSearch} style={{
              background:'#dc2626',color:'white',border:'none',
              borderRadius:6,padding:'8px 16px',cursor:'pointer',fontSize:14
            }}>停止</button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {(searching || progress>0) && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:'#666',marginBottom:4}}>
            {progress} / 65536 ({(progress/655.36).toFixed(1)}%) · 找到 {results.length} 条
          </div>
          <div style={{background:'#1a1a2e',borderRadius:4,height:6}}>
            <div style={{
              background:'#7c3aed',height:'100%',borderRadius:4,
              width:`${progress/655.36}%`,transition:'width 0.2s'
            }}/>
          </div>
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div style={{marginBottom:16}}>
          <div style={{color:'#34d399',fontWeight:'bold',fontSize:13,marginBottom:8}}>
            找到 {results.length} 条规则
            <span style={{color:'#666',fontWeight:'normal',marginLeft:12}}>
              （点击查看详情）
            </span>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {results.map((r,idx)=>(
              <button key={idx} onClick={()=>setSelected(r)} style={{
                background: selected===r ? '#4c1d95' : '#111120',
                border:`1px solid ${selected===r?'#a78bfa':'#2a2a3e'}`,
                color: selected===r?'#e2e8f0':'#aaa',
                borderRadius:6,padding:'5px 10px',
                cursor:'pointer',fontSize:11,
              }}>
                #{r.ruleInt} · 第{r.step}步
                {r.hiLatin&&r.loLatin?' ⊕':''}
              </button>
            ))}
          </div>
          <div style={{fontSize:10,color:'#555',marginTop:6}}>
            ⊕ 标记表示高2位和低2位均构成拉丁方（GF(4)正交结构）
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div style={{background:'#111120',borderRadius:8,padding:16}}>
          <div style={{
            display:'flex',gap:8,alignItems:'center',marginBottom:12,flexWrap:'wrap'
          }}>
            <span style={{color:'#a78bfa',fontWeight:'bold',fontSize:15}}>
              规则 #{selected.ruleInt}
            </span>
            <span style={{color:'#666',fontSize:12}}>
              0x{selected.ruleInt.toString(16).padStart(4,'0').toUpperCase()}
            </span>
            <span style={{color:'#666',fontSize:12}}>
              二进制: {selected.ruleInt.toString(2).padStart(16,'0')}
            </span>
            {selected.hiLatin && (
              <span style={{color:'#34d399',fontSize:11,
                background:'#052e16',padding:'2px 6px',borderRadius:4}}>
                高2位构成拉丁方
              </span>
            )}
            {selected.loLatin && (
              <span style={{color:'#60a5fa',fontSize:11,
                background:'#0c1a3f',padding:'2px 6px',borderRadius:4}}>
                低2位构成拉丁方
              </span>
            )}
            <button
              onClick={() => exportResultAsJson(selected)}
              style={{
                marginLeft: "auto",
                background: "#7c3aed",
                color: "white",
                border: "none",
                borderRadius: 6,
                padding: "6px 12px",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: "bold",
              }}
            >
              导出 JSON（用于 4x4 导入）
            </button>
          </div>

          <div style={{display:'flex',gap:24,flexWrap:'wrap',marginBottom:16}}>
            <div>
              <div style={{fontSize:11,color:'#888',marginBottom:6}}>线性规则矩阵</div>
              <RuleMatrix ruleInt={selected.ruleInt}/>
            </div>
            <div>
              <div style={{fontSize:11,color:'#888',marginBottom:6}}>
                第{selected.step}步输出（幻方）
              </div>
              <CellGrid grid={selected.grid} highlight={true}/>
            </div>
            <div>
              <div style={{fontSize:11,color:'#888',marginBottom:6}}>幻方数值</div>
              <div style={{lineHeight:2}}>
                {selected.grid.map((row,i)=>(
                  <div key={i} style={{display:'flex',gap:4}}>
                    {row.map((v,j)=>(
                      <span key={j} style={{
                        width:32,textAlign:'right',
                        color: v===0||v===15 ? '#a78bfa' : '#e2e8f0',
                        fontSize:14,fontWeight:'bold'
                      }}>{v+1}</span>
                    ))}
                  </div>
                ))}
              </div>
              <div style={{fontSize:11,color:'#555',marginTop:8}}>
                行列对角线和均为 34
              </div>
            </div>
          </div>

          <div style={{marginTop:8}}>
            <div style={{fontSize:11,color:'#888',marginBottom:8}}>完整演化轨迹</div>
            <EvolutionTrace ruleInt={selected.ruleInt} steps={selected.step}/>
          </div>
        </div>
      )}

      {!searching && results.length===0 && progress===0 && (
        <div style={{
          background:'#111120',borderRadius:8,padding:32,
          textAlign:'center',color:'#444'
        }}>
          点击"开始搜索"，在 65536 种线性规则中寻找能演化出幻方的规则
        </div>
      )}

      {!searching && results.length===0 && progress>=65536 && (
        <div style={{
          background:'#111120',borderRadius:8,padding:32,
          textAlign:'center',color:'#f97316'
        }}>
          在当前步数限制内未找到满足条件的线性规则。<br/>
          <span style={{fontSize:12,color:'#666'}}>
            可尝试增加步数，或考虑扩展到非线性规则的局部搜索。
          </span>
        </div>
      )}
    </div>
  );
}
