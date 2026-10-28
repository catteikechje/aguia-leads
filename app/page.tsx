"use client";

import { useEffect, useState } from "react";
import ChamarWhatsApp from "@/components/ChamarWhatsApp";
import { ESTADOS } from "@/lib/estados";
import { NICHOS } from "@/lib/nichos";
import type { Empresa, RespostaBusca } from "@/lib/types";
import { LIMITE_DIARIO, registro } from "@/lib/whatsapp";

export default function Radar() {
  const [uf, setUf] = useState("RJ");
  const [cidade, setCidade] = useState("Rio de Janeiro");
  const [nicho, setNicho] = useState("Hamburgueria");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState<RespostaBusca | null>(null);
  const [titulo, setTitulo] = useState("");
  const [aberta, setAberta] = useState<Empresa | null>(null);
  const [contatados, setContatados] = useState<string[]>([]);
  const [bloqueados, setBloqueados] = useState<string[]>([]);

  useEffect(() => {
    setContatados(registro.contatadosHoje());
    setBloqueados(registro.naoContatar());
    try {
      setSenha(localStorage.getItem("aguia-senha") ?? "");
    } catch {}
  }, []);

  function trocarUf(novo: string) {
    setUf(novo);
    setCidade(ESTADOS.find((e) => e.uf === novo)?.capital ?? "");
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    setErro("");
    try {
      const r = await fetch("/api/buscar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-senha": senha },
        body: JSON.stringify({ uf, cidade, nicho }),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? "Erro na busca.");
      try {
        localStorage.setItem("aguia-senha", senha);
      } catch {}
      setResultado(dados);
      setTitulo(`${nicho} em ${cidade}/${uf}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Erro na busca.");
    } finally {
      setCarregando(false);
    }
  }

  function abriuConversa(emp: Empresa) {
    registro.marcarContato(emp.id);
    setContatados(registro.contatadosHoje());
    setTimeout(() => setAberta(null), 300);
  }

  function naoContatar(emp: Empresa) {
    registro.marcarNaoContatar(emp.id);
    setBloqueados(registro.naoContatar());
    setAberta(null);
  }

  const visiveis = resultado?.empresas.filter((e) => !bloqueados.includes(e.id)) ?? [];

  return (
    <main className="wrap">
      <header className="topo">
        <div className="logo"><i /> Águia Leads</div>
        <span className={"contador" + (contatados.length >= LIMITE_DIARIO ? " acima" : "")} title="Conversas que você abriu hoje. Mantenha baixo para não ser bloqueado.">
          WhatsApp hoje: {contatados.length} de {LIMITE_DIARIO}
        </span>
      </header>

      <h1>Empresas reais <em>sem site</em>, direto do mapa</h1>
      <p className="sub">Escolha o nicho e a cidade. A lista mostra empresas reais que estão no mapa sem site próprio (ou só com Instagram). Quem tem WhatsApp aparece primeiro.</p>

      <form className="filtros" onSubmit={buscar}>
        <label>
          <span className="rotulo">Nicho</span>
          <input list="nichos" value={nicho} onChange={(e) => setNicho(e.target.value)} required />
          <datalist id="nichos">{NICHOS.map((n) => <option key={n} value={n} />)}</datalist>
        </label>
        <label>
          <span className="rotulo">Estado</span>
          <select value={uf} onChange={(e) => trocarUf(e.target.value)}>
            {ESTADOS.map((e) => <option key={e.uf} value={e.uf}>{e.nome}</option>)}
          </select>
        </label>
        <label>
          <span className="rotulo">Cidade</span>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} required />
        </label>
        <label>
          <span className="rotulo">Senha (opcional)</span>
          <input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
        </label>
        <button className="btn-primario" type="submit" disabled={carregando}>
          {carregando ? "Buscando empresas..." : "Buscar empresas sem site"}
        </button>
      </form>

      {erro && <p className="erro">{erro}</p>}

      {resultado && (
        <section>
          <div className="res-topo">
            <h2>{visiveis.length} sem site · {titulo}</h2>
            <span className="mono">{resultado.analisadas} empresas analisadas {resultado.fonte === "google" ? "no Google" : "no mapa"}</span>
          </div>
          {visiveis.length === 0 ? (
            <p className="vazio">Nenhuma empresa sem site nessa busca. Tente outro bairro, cidade ou nicho.</p>
          ) : (
            <div className="cards">
              {visiveis.map((emp) => {
                const jaChamou = contatados.includes(emp.id);
                return (
                  <article key={emp.id} className="card">
                    <div className="card-topo">
                      <h3>{emp.nome}</h3>
                      <span className="tag">{emp.redeSocial ? "só rede social" : "sem site"}</span>
                    </div>
                    <div className="meta">
                      <span>{emp.tipo}</span>
                      <span>{emp.endereco}</span>
                    </div>
                    <div className="fone">
                      <span className="mono">{emp.telefone || "telefone não informado"}</span>
                      {emp.telefone && <span className={emp.whatsapp ? "ok" : "mut"}>{emp.whatsapp ? "WhatsApp provável" : "telefone fixo"}</span>}
                    </div>
                    <div className="linha-meta">
                      {emp.nota ? <span className="estrelas">★ {emp.nota.toFixed(1)} ({emp.avaliacoes})</span> : <span className="mut">sem avaliações</span>}
                      {emp.mapsUrl && <a href={emp.mapsUrl} target="_blank" rel="noopener">Ver no Maps</a>}
                    </div>
                    {emp.whatsapp ? (
                      <button className={"btn-wa" + (jaChamou ? " feito" : "")} type="button" onClick={() => setAberta(emp)}>
                        {jaChamou ? "✓ Chamado hoje · abrir de novo" : "Chamar no WhatsApp"}
                      </button>
                    ) : emp.telefone ? (
                      <a className="btn-ghost" href={`tel:+55${emp.telefone.replace(/\D/g, "")}`}>Ligar</a>
                    ) : (
                      <a className="btn-ghost" href={emp.mapsUrl} target="_blank" rel="noopener">Achar o telefone no Google</a>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {aberta && (
        <ChamarWhatsApp
          empresa={aberta}
          contatosHoje={contatados.length}
          onFechar={() => setAberta(null)}
          onAbriu={() => abriuConversa(aberta)}
          onNaoContatar={() => naoContatar(aberta)}
        />
      )}
    </main>
  );
}
