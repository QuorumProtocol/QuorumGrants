import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { useWallet, useContract } from "./useContract.js";

const styles = {
  app: { maxWidth: 860, margin: "0 auto", padding: "2rem 1rem" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" },
  title: { fontSize: "1.6rem", fontWeight: 700, color: "#a78bfa" },
  btn: {
    background: "#7c3aed", color: "#fff", border: "none",
    padding: "0.5rem 1.2rem", borderRadius: 8, fontWeight: 600, fontSize: "0.9rem",
  },
  btnSm: {
    background: "#1e1b4b", color: "#a78bfa", border: "1px solid #4c1d95",
    padding: "0.3rem 0.8rem", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600,
  },
  btnDanger: {
    background: "#7f1d1d", color: "#fca5a5", border: "none",
    padding: "0.3rem 0.8rem", borderRadius: 6, fontSize: "0.8rem", fontWeight: 600,
  },
  card: {
    background: "#1a1a2e", border: "1px solid #2d2d4e", borderRadius: 12,
    padding: "1.2rem", marginBottom: "1rem",
  },
  form: { display: "flex", flexDirection: "column", gap: "0.8rem" },
  input: {
    background: "#0f0f1a", border: "1px solid #2d2d4e", color: "#e2e8f0",
    padding: "0.5rem 0.8rem", borderRadius: 8, fontSize: "0.9rem", width: "100%",
  },
  label: { fontSize: "0.8rem", color: "#94a3b8", marginBottom: 2 },
  badge: (color) => ({
    display: "inline-block", padding: "0.15rem 0.6rem", borderRadius: 99,
    fontSize: "0.75rem", fontWeight: 700,
    background: color === "green" ? "#14532d" : color === "red" ? "#7f1d1d" : "#1e1b4b",
    color: color === "green" ? "#86efac" : color === "red" ? "#fca5a5" : "#a78bfa",
  }),
  progress: { background: "#2d2d4e", borderRadius: 99, height: 6, overflow: "hidden", margin: "0.4rem 0" },
  progressBar: (pct) => ({ width: `${pct}%`, height: "100%", background: "#7c3aed", transition: "width 0.3s" }),
  row: { display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" },
  section: { marginBottom: "2rem" },
  sectionTitle: { fontSize: "1.1rem", fontWeight: 700, marginBottom: "1rem", color: "#c4b5fd" },
  addr: { fontFamily: "monospace", fontSize: "0.8rem", color: "#94a3b8" },
  error: { color: "#fca5a5", fontSize: "0.85rem" },
};

function GrantCard({ id, contract, address, onRefresh }) {
  const [grant, setGrant] = useState(null);
  const [hasApproved, setHasApproved] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!contract) return;
    const g = await contract.getGrant(id);
    setGrant(g);
    if (address) {
      const approved = await contract.hasApproved(id, address);
      setHasApproved(approved);
    }
  }, [contract, id, address]);

  useEffect(() => { load(); }, [load]);

  if (!grant) return <div style={styles.card}><span style={styles.addr}>Loading grant #{id}…</span></div>;

  const pct = Math.round((Number(grant.approvalCount) / Number(grant.quorumThreshold)) * 100);
  const status = grant.executed ? "executed" : grant.cancelled ? "cancelled" : "active";
  const statusColor = grant.executed ? "green" : grant.cancelled ? "red" : "purple";

  async function handleApprove() {
    setLoading(true);
    try {
      const tx = await contract.approve(id);
      await tx.wait();
      await load();
      onRefresh?.();
    } catch (e) {
      alert(e.reason ?? e.message);
    } finally { setLoading(false); }
  }

  async function handleCancel() {
    setLoading(true);
    try {
      const tx = await contract.cancel(id);
      await tx.wait();
      await load();
      onRefresh?.();
    } catch (e) {
      alert(e.reason ?? e.message);
    } finally { setLoading(false); }
  }

  const isReviewer = grant.reviewers.map(r => r.toLowerCase()).includes(address?.toLowerCase());
  const isProposer = grant.proposer.toLowerCase() === address?.toLowerCase();

  return (
    <div style={styles.card}>
      <div style={{ ...styles.row, justifyContent: "space-between", marginBottom: "0.6rem" }}>
        <span style={{ fontWeight: 700 }}>Grant #{id}</span>
        <span style={styles.badge(statusColor)}>{status}</span>
      </div>
      <p style={{ marginBottom: "0.5rem", color: "#cbd5e1" }}>{grant.description}</p>
      <div style={styles.row}>
        <span style={styles.addr}>Recipient: {grant.recipient.slice(0, 8)}…{grant.recipient.slice(-6)}</span>
        <span style={{ ...styles.addr, color: "#a78bfa" }}>
          {ethers.formatEther(grant.amount)} ETH
        </span>
      </div>
      <div style={{ margin: "0.6rem 0" }}>
        <div style={styles.row}>
          <span style={styles.label}>
            Quorum: {Number(grant.approvalCount)}/{Number(grant.quorumThreshold)}
          </span>
        </div>
        <div style={styles.progress}>
          <div style={styles.progressBar(Math.min(pct, 100))} />
        </div>
      </div>
      {status === "active" && address && (
        <div style={styles.row}>
          {isReviewer && !hasApproved && (
            <button style={styles.btnSm} onClick={handleApprove} disabled={loading}>
              {loading ? "Approving…" : "Approve"}
            </button>
          )}
          {isReviewer && hasApproved && (
            <span style={styles.badge("green")}>✓ You approved</span>
          )}
          {isProposer && (
            <button style={styles.btnDanger} onClick={handleCancel} disabled={loading}>
              {loading ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CreateGrantForm({ contract, onCreated }) {
  const [form, setForm] = useState({
    recipient: "", description: "", reviewers: "", threshold: "2", amount: "0.1",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(k) { return (e) => setForm(f => ({ ...f, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const reviewers = form.reviewers.split(",").map(s => s.trim()).filter(Boolean);
      const tx = await contract.createGrant(
        form.recipient,
        form.description,
        reviewers,
        Number(form.threshold),
        { value: ethers.parseEther(form.amount) }
      );
      await tx.wait();
      setForm({ recipient: "", description: "", reviewers: "", threshold: "2", amount: "0.1" });
      onCreated?.();
    } catch (e) {
      setError(e.reason ?? e.message);
    } finally { setLoading(false); }
  }

  return (
    <form style={styles.form} onSubmit={submit}>
      {[
        ["recipient", "Recipient Address", "0x…"],
        ["description", "Description", "What will this grant fund?"],
        ["reviewers", "Reviewers (comma-separated addresses)", "0xA…, 0xB…, 0xC…"],
        ["threshold", "Quorum Threshold", "2"],
        ["amount", "Amount (ETH)", "0.1"],
      ].map(([key, label, placeholder]) => (
        <div key={key}>
          <div style={styles.label}>{label}</div>
          <input
            style={styles.input}
            placeholder={placeholder}
            value={form[key]}
            onChange={set(key)}
            required
          />
        </div>
      ))}
      {error && <p style={styles.error}>{error}</p>}
      <button style={styles.btn} type="submit" disabled={loading}>
        {loading ? "Creating…" : "Create Grant"}
      </button>
    </form>
  );
}

export default function App() {
  const { signer, address, connect } = useWallet();
  const contract = useContract(signer);
  const [count, setCount] = useState(0);
  const [showCreate, setShowCreate] = useState(false);

  const loadCount = useCallback(async () => {
    if (!contract) return;
    try {
      const c = await contract.grantCount();
      setCount(Number(c));
    } catch {}
  }, [contract]);

  useEffect(() => { loadCount(); }, [loadCount]);

  return (
    <div style={styles.app}>
      <div style={styles.header}>
        <div>
          <div style={styles.title}>⬡ QuorumGrants</div>
          <div style={{ ...styles.addr, marginTop: 4 }}>
            Decentralized quorum-based grant funding
          </div>
        </div>
        {address ? (
          <span style={styles.badge("purple")}>{address.slice(0, 6)}…{address.slice(-4)}</span>
        ) : (
          <button style={styles.btn} onClick={connect}>Connect Wallet</button>
        )}
      </div>

      {address && (
        <div style={styles.section}>
          <div style={{ ...styles.row, justifyContent: "space-between", marginBottom: "1rem" }}>
            <div style={styles.sectionTitle}>Grants ({count})</div>
            <button style={styles.btn} onClick={() => setShowCreate(v => !v)}>
              {showCreate ? "Cancel" : "+ New Grant"}
            </button>
          </div>
          {showCreate && (
            <div style={{ ...styles.card, marginBottom: "1.5rem" }}>
              <div style={{ ...styles.sectionTitle, marginBottom: "1rem" }}>Create Grant</div>
              <CreateGrantForm contract={contract} onCreated={() => { loadCount(); setShowCreate(false); }} />
            </div>
          )}
          {count === 0 && <p style={styles.addr}>No grants yet. Create the first one!</p>}
          {Array.from({ length: count }, (_, i) => (
            <GrantCard key={i} id={i} contract={contract} address={address} onRefresh={loadCount} />
          ))}
        </div>
      )}

      {!address && (
        <div style={{ ...styles.card, textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "#94a3b8", marginBottom: "1rem" }}>
            Connect your wallet to create and review grants.
          </p>
          <button style={styles.btn} onClick={connect}>Connect Wallet</button>
        </div>
      )}
    </div>
  );
}
