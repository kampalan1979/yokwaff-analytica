import { useState, useRef } from "react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

// ── COLORS & THEME ──────────────────────────────────────────
const DANGER = "#ff3b3b";
const WARN = "#ff9f1c";
const SAFE = "#1a936f";
const BG = "#0d0d0d";
const CARD = "#161616";
const BORDER = "#2a2a2a";
const TEXT = "#e8e8e8";
const MUTED = "#666";
const COLORS = ["#ff6b35", "#f7c59f", "#efefd0", "#004e89", "#1a936f", "#c84b31", "#88d498"];

// ── GAMBLING PLATFORM DETECTION ────────────────────────────
const GAMBLING_KEYWORDS = [
  "mei lin", "betpawa", "yo uganda", "intouch", "admiral bet",
  "enterprise gaming", "betting", "casino", "wager", "stake"
];

const LENDING_KEYWORDS = [
  "housing finance", "jumo", "movo", "branch", "tala", "loan"
];

const AIRTEL_KEYWORDS = ["airtel", "artel", "atl"];

// ── UTILITIES ───────────────────────────────────────────────
const fmt = (n) => "UGX " + Number(n).toLocaleString();
const fmtK = (n) => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(0)}K` : n;

const parseAmount = (str) => {
  const match = str.match(/[\d,]+\.?\d*/);
  if (!match) return 0;
  return parseFloat(match[0].replace(/,/g, ""));
};

const isGambling = (desc) => GAMBLING_KEYWORDS.some(kw => desc.toLowerCase().includes(kw));
const isLending = (desc) => LENDING_KEYWORDS.some(kw => desc.toLowerCase().includes(kw));
const isAirtel = (desc) => AIRTEL_KEYWORDS.some(kw => desc.toLowerCase().includes(kw));

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: "#1e1e1e", border: "1px solid #333", borderRadius: 8, padding: "10px 14px" }}>
        <p style={{ color: "#aaa", margin: "0 0 6px", fontSize: 12 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, margin: "2px 0", fontSize: 13 }}>
            {p.name}: {fmt(p.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const StatCard = ({ label, value, sub, color = TEXT }) => (
  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "18px 20px", flex: 1, minWidth: 140 }}>
    <div style={{ color: MUTED, fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8 }}>{label}</div>
    <div style={{ color: color, fontSize: 22, fontWeight: 700, fontFamily: "monospace" }}>{value}</div>
    {sub && <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>{sub}</div>}
  </div>
);

const SectionTitle = ({ children, accent }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "28px 0 16px" }}>
    {accent && <div style={{ width: 4, height: 20, background: accent, borderRadius: 2 }} />}
    <h2 style={{ color: TEXT, margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: 0.3 }}>{children}</h2>
  </div>
);

const InsightBadge = ({ type, children }) => {
  const colors = { danger: "#ff3b3b22", warn: "#ff9f1c22", ok: "#1a936f22" };
  const borders = { danger: "#ff3b3b55", warn: "#ff9f1c55", ok: "#1a936f55" };
  const texts = { danger: DANGER, warn: WARN, ok: SAFE };
  return (
    <div style={{
      background: colors[type], border: `1px solid ${borders[type]}`,
      borderRadius: 8, padding: "10px 14px", marginBottom: 10,
      color: texts[type], fontSize: 13, lineHeight: 1.6
    }}>
      {children}
    </div>
  );
};

// ── PDF PARSER ──────────────────────────────────────────────
const parsePDF = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = async () => {
          const pdfjsLib = window.pdfjsLib;
          pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          
          const pdf = await pdfjsLib.getDocument({ data }).promise;
          let fullText = "";
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const text = await page.getTextContent();
            const pageText = text.items.map(item => item.str).join(" ");
            fullText += pageText + "\n";
          }
          
          resolve(fullText);
        };
        script.onerror = () => reject(new Error("Failed to load PDF.js library"));
        document.head.appendChild(script);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
};

// ── TRANSACTION PARSER ──────────────────────────────────────
const parseTransactions = (text) => {
  const lines = text.split("\n");
  const transactions = [];
  
  // Try to detect date pattern and parse
  const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
  const amountRegex = /[\d,]+\.?\d*/g;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const dateMatch = line.match(dateRegex);
    const amounts = line.match(amountRegex);
    
    if (dateMatch && amounts && amounts.length >= 1) {
      // Extract description (usually first part)
      const desc = line.substring(0, line.indexOf(dateMatch[0])).trim() ||
                   line.substring(line.indexOf(dateMatch[0]) + dateMatch[0].length).trim();
      
      // Get the largest amount as the transaction amount
      const amount = Math.max(...amounts.map(a => parseFloat(a.replace(/,/g, ""))));
      
      if (amount > 0 && desc.length > 2) {
        transactions.push({
          date: dateMatch[0],
          description: desc.substring(0, 60),
          amount: amount,
          isGambling: isGambling(desc),
          isLending: isLending(desc),
          isAirtel: isAirtel(desc),
          type: isGambling(desc) ? "gambling" : isAirtel(desc) ? "airtel" : isLending(desc) ? "lending" : "other"
        });
      }
    }
  }
  
  return transactions;
};

// ── ANALYSIS GENERATOR ──────────────────────────────────────
const analyzeTransactions = (transactions) => {
  const inflows = transactions.filter(t => !isGambling(t.description) && !isAirtel(t.description));
  const gambling = transactions.filter(t => isGambling(t.description));
  const airtel = transactions.filter(t => isAirtel(t.description));
  const lending = transactions.filter(t => isLending(t.description));
  
  const totalIn = inflows.reduce((sum, t) => sum + t.amount, 0);
  const totalGambling = gambling.reduce((sum, t) => sum + t.amount, 0);
  const totalAirtel = airtel.reduce((sum, t) => sum + t.amount, 0);
  const totalLending = lending.reduce((sum, t) => sum + t.amount, 0);
  
  // Group by description for top recipients
  const recipientMap = {};
  transactions.forEach(t => {
    if (!recipientMap[t.description]) {
      recipientMap[t.description] = { desc: t.description, amount: 0, isGambling: t.isGambling };
    }
    recipientMap[t.description].amount += t.amount;
  });
  
  const topRecipients = Object.values(recipientMap)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);
  
  // Group gambling by platform
  const gamblingByPlatform = {};
  gambling.forEach(t => {
    const key = t.description.split(" ")[0];
    if (!gamblingByPlatform[key]) {
      gamblingByPlatform[key] = { name: t.description, value: 0 };
    }
    gamblingByPlatform[key].value += t.amount;
  });
  
  return {
    totalIn,
    totalGambling,
    totalAirtel,
    totalLending,
    gamblingPct: totalIn > 0 ? Math.round((totalGambling / totalIn) * 100) : 0,
    topRecipients,
    gamblingPlatforms: Object.values(gamblingByPlatform),
    transactions,
    gambling,
    inflows,
    airtel,
    lending
  };
};

// ── MAIN APP ────────────────────────────────────────────────
export default function YoKwaffAnalytica() {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const text = await parsePDF(file);
      const transactions = parseTransactions(text);
      
      if (transactions.length === 0) {
        setError("No transactions found. Please check the PDF format.");
        setLoading(false);
        return;
      }

      const result = analyzeTransactions(transactions);
      setAnalysis(result);
    } catch (err) {
      setError(`Error parsing PDF: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!analysis) {
    return (
      <div style={{ background: BG, minHeight: "100vh", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: TEXT, padding: "40px 20px" }}>
        <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 16px", color: TEXT }}>YoKwaff! Analytica</h1>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: 40, lineHeight: 1.6 }}>
            Privacy-first mobile money analysis. Upload your MTN MoMo or Airtel Money statement PDF to see your spending patterns, gambling exposure, and financial health insights.
          </p>

          <div 
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: CARD,
              border: `2px dashed ${BORDER}`,
              borderRadius: 12,
              padding: "60px 40px",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = WARN}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = BORDER}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 8 }}>Upload Your Statement</div>
            <div style={{ fontSize: 13, color: MUTED }}>PDF format only • No data sent to servers • All analysis happens on your device</div>
            <input 
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </div>

          {error && (
            <div style={{ background: "#ff3b3b22", border: `1px solid #ff3b3b55`, borderRadius: 8, padding: 16, marginTop: 24, color: DANGER, fontSize: 13 }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ marginTop: 24, color: MUTED }}>
              <div style={{ fontSize: 12, marginBottom: 8 }}>Processing PDF...</div>
              <div style={{ display: "inline-block", width: 20, height: 20, border: `2px solid ${BORDER}`, borderTop: `2px solid ${WARN}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          <div style={{ marginTop: 40, paddingTop: 40, borderTop: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 1, marginBottom: 16 }}>Supported Formats</div>
            <p style={{ fontSize: 13, color: MUTED, margin: 0 }}>MTN MoMo PDF statements • Airtel Money PDF statements</p>
            <div style={{ marginTop: 16, fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
              <p>💡 Pro tip: Export your statement directly from your mobile money app (usually in Settings → Download Statement)</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "recipients", label: "Top Recipients" },
    { id: "gambling", label: "Gambling Analysis" },
    { id: "insights", label: "Insights" }
  ];

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", color: TEXT, padding: "0 0 60px" }}>
      {/* Header */}
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: "20px 28px 0", position: "sticky", top: 0, background: BG, zIndex: 10 }}>
        <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: 2, marginBottom: 4 }}>Financial Analysis</div>
        <h1 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 700, color: TEXT }}>YoKwaff! Analytica</h1>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              background: tab === t.id ? "#fff" : "transparent",
              color: tab === t.id ? "#000" : MUTED,
              border: "none", borderRadius: "8px 8px 0 0",
              padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              transition: "all 0.2s"
            }}>{t.label}</button>
          ))}
          <button onClick={() => {
            setAnalysis(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }} style={{
            background: "transparent", color: MUTED, border: "none",
            padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            marginLeft: "auto"
          }}>Upload New</button>
        </div>
      </div>

      <div style={{ padding: "24px 28px" }}>
        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <>
            <div style={{ color: MUTED, fontSize: 12, marginBottom: 16 }}>
              {analysis.transactions.length} transactions analyzed
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
              <StatCard label="Total Inflows" value={fmtK(analysis.totalIn)} sub="Money in" color={SAFE} />
              <StatCard label="Gambling Spend" value={fmtK(analysis.totalGambling)} sub={`${analysis.gamblingPct}% of inflows`} color={analysis.gamblingPct > 20 ? DANGER : WARN} />
              <StatCard label="Airtel Transfers" value={fmtK(analysis.totalAirtel)} sub="Person-to-person" color={TEXT} />
              <StatCard label="Lending Activity" value={analysis.lending.length > 0 ? "⚠️ Active" : "None"} sub={`${analysis.lending.length} transactions`} color={analysis.lending.length > 0 ? WARN : SAFE} />
            </div>

            {analysis.gamblingPct > 0 && (
              <div style={{ background: CARD, border: `1px solid ${DANGER}55`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <div style={{ color: DANGER, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>🎰 Gambling Risk Flag</div>
                <div style={{ color: TEXT, fontSize: 13, lineHeight: 1.6 }}>
                  {analysis.gamblingPct > 40 ? (
                    <>This account shows <strong>high gambling exposure</strong> at {analysis.gamblingPct}% of spending. This pattern is associated with financial distress. Consider setting spending limits.</>
                  ) : analysis.gamblingPct > 20 ? (
                    <>Gambling accounts for {analysis.gamblingPct}% of spending. Monitor this trend to ensure it doesn't escalate.</>
                  ) : (
                    <>Gambling is {analysis.gamblingPct}% of spending. Keep monitoring to catch escalation early.</>
                  )}
                </div>
              </div>
            )}

            {analysis.lending.length > 0 && (
              <div style={{ background: CARD, border: `1px solid ${WARN}55`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
                <div style={{ color: WARN, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>⚠️ Active Lending Detected</div>
                <div style={{ color: TEXT, fontSize: 13, lineHeight: 1.6 }}>
                  Loans from {analysis.lending.map(l => l.description.split(" ")[0]).join(", ")}. If borrowed money is funding gambling, this significantly escalates financial risk.
                </div>
              </div>
            )}

            <SectionTitle accent="#ff6b35">Spending Breakdown</SectionTitle>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "16px 8px", marginBottom: 24 }}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Gambling", value: analysis.totalGambling },
                      { name: "Airtel Transfers", value: analysis.totalAirtel },
                      { name: "Lending", value: analysis.totalLending },
                      { name: "Other", value: analysis.totalIn - analysis.totalGambling - analysis.totalAirtel - analysis.totalLending }
                    ]}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {[DANGER, TEXT, WARN, MUTED].map((color, i) => <Cell key={i} fill={color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {/* ── RECIPIENTS TAB ── */}
        {tab === "recipients" && (
          <>
            <SectionTitle accent={DANGER}>Top Recipients</SectionTitle>
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
              {analysis.topRecipients.map((d, i) => {
                const pct = Math.round((d.amount / analysis.totalIn) * 100);
                return (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 13 }}>
                      <span style={{ color: d.isGambling ? DANGER : TEXT }}>
                        {d.isGambling ? "🎰 " : ""}{d.desc}
                      </span>
                      <span style={{ fontFamily: "monospace", color: d.isGambling ? DANGER : MUTED }}>{fmt(d.amount)} ({pct}%)</span>
                    </div>
                    <div style={{ height: 4, background: "#222", borderRadius: 2 }}>
                      <div style={{ width: `${pct * 4}%`, height: "100%", background: d.isGambling ? DANGER : "#334", borderRadius: 2 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── GAMBLING TAB ── */}
        {tab === "gambling" && (
          <>
            {analysis.gambling.length > 0 ? (
              <>
                <SectionTitle accent={DANGER}>Gambling Platform Breakdown</SectionTitle>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 24 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={analysis.gamblingPlatforms}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={75}
                        label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {analysis.gamblingPlatforms.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  {analysis.gamblingPlatforms.map((d, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 12 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[i % COLORS.length], display: "inline-block" }} />
                        {d.name}
                      </span>
                      <span style={{ fontFamily: "monospace", color: MUTED }}>{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>

                <SectionTitle accent={DANGER}>Gambling Transactions</SectionTitle>
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
                  {analysis.gambling.slice(0, 15).map((t, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < analysis.gambling.length - 1 ? `1px solid ${BORDER}` : "none", fontSize: 12 }}>
                      <span style={{ color: TEXT }}>{t.date} · {t.description}</span>
                      <span style={{ color: DANGER, fontFamily: "monospace" }}>{fmt(t.amount)}</span>
                    </div>
                  ))}
                  {analysis.gambling.length > 15 && (
                    <div style={{ color: MUTED, fontSize: 11, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${BORDER}` }}>
                      +{analysis.gambling.length - 15} more transactions
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{ background: CARD, border: `1px solid ${SAFE}55`, borderRadius: 12, padding: 24, textAlign: "center" }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
                <div style={{ color: SAFE, fontSize: 16, fontWeight: 600 }}>No Gambling Detected</div>
                <div style={{ color: MUTED, fontSize: 13, marginTop: 8 }}>This account shows no identifiable gambling transactions.</div>
              </div>
            )}
          </>
        )}

        {/* ── INSIGHTS TAB ── */}
        {tab === "insights" && (
          <>
            <SectionTitle accent={WARN}>Key Insights</SectionTitle>
            
            {analysis.gamblingPct > 40 && (
              <InsightBadge type="danger">
                🎰 High gambling exposure: {analysis.gamblingPct}% of inflows went to gambling platforms. This pattern is associated with financial distress and loan cycling.
              </InsightBadge>
            )}

            {analysis.gamblingPct > 0 && analysis.lending.length > 0 && (
              <InsightBadge type="danger">
                ⚠️ Borrowed money funding gambling: Active loans detected while gambling transactions are present. This escalates financial risk significantly.
              </InsightBadge>
            )}

            {analysis.totalAirtel > analysis.totalIn * 0.5 && (
              <InsightBadge type="warn">
                🔄 High velocity transfers: {Math.round((analysis.totalAirtel / analysis.totalIn) * 100)}% of money is moving to other accounts. Possible intermediary pattern.
              </InsightBadge>
            )}

            {analysis.gambling.length > 0 && analysis.totalIn > 0 && (
              <InsightBadge type="warn">
                📊 Gambling is {analysis.gamblingPct}% of spending. Recommend setting a {Math.max(5, Math.round(analysis.gamblingPct * 0.5))}% target (divide by 8-10x).
              </InsightBadge>
            )}

            {analysis.lending.length > 0 && (
              <InsightBadge type="warn">
                🏦 Active lending: Loans are a sign of cash flow constraints. Avoid using loans for discretionary spending like gambling.
              </InsightBadge>
            )}

            {analysis.gambling.length === 0 && analysis.lending.length === 0 && (
              <InsightBadge type="ok">
                ✓ No major risk patterns: This account shows healthy spending patterns. No gambling or lending detected.
              </InsightBadge>
            )}

            <SectionTitle accent={SAFE}>Recommendations</SectionTitle>
            <div style={{ background: CARD, border: `1px solid ${SAFE}44`, borderRadius: 12, padding: 16 }}>
              {[
                ["Save at least 10–20% of every inflow", `Currently: ${Math.round(((analysis.totalIn - analysis.totalGambling - analysis.totalAirtel) / analysis.totalIn) * 100)}%`],
                ["Keep gambling/entertainment under 5% of spending", `Currently: ${analysis.gamblingPct}%`],
                ["Avoid loans for non-productive purposes", analysis.lending.length > 0 ? "⚠️ Active loans detected" : "✓ No loans"],
                ["Let balance grow month-over-month", "Check trend in next statement"],
              ].map(([goal, current], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${BORDER}`, fontSize: 13, gap: 16 }}>
                  <span style={{ color: SAFE }}>✓ {goal}</span>
                  <span style={{ color: current.includes("⚠️") ? WARN : DANGER, fontSize: 12, textAlign: "right" }}>{current}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
