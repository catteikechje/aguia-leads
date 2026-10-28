"use client";

import { useEffect, useRef, useState } from "react";
import type { Empresa } from "@/lib/types";
import { LIMITE_DIARIO, MODELOS, linkWhatsApp, registro } from "@/lib/whatsapp";

type Props = {
  empresa: Empresa;
  contatosHoje: number;
  onFechar: () => void;
  onAbriu: () => void;
  onNaoContatar: () => void;
};

export default function ChamarWhatsApp({ empresa, contatosHoje, onFechar, onAbriu, onNaoContatar }: Props) {
  const [eu, setEu] = useState("");
  const [modelo, setModelo] = useState(0);
  const [texto, setTexto] = useState("");
  const [editado, setEditado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const caixa = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const nome = registro.meuNome();
    const m = Math.floor(Math.random() * MODELOS.length);
    setEu(nome);
    setModelo(m);
    setTexto(MODELOS[m].texto(empresa, nome));
    setEditado(false);
    caixa.current?.focus();
  }, [empresa]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    addEventListener("keydown", esc);
    return () => removeEventListener("keydown", esc);
  }, [onFechar]);

  function trocarModelo(m: number) {
    if (editado && !confirm("Trocar o modelo apaga o que você editou. Continuar?")) return;
    setModelo(m);
    setTexto(MODELOS[m].texto(empresa, eu));
    setEditado(false);
  }

  function mudarNome(n: string) {
    setEu(n);
    registro.salvarNome(n.trim());
    if (!editado) setTexto(MODELOS[modelo].texto(empresa, n.trim()));
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1400);
    } catch {}
  }

  function naoContatar() {
    if (!confirm(`${empresa.nome} não vai mais aparecer para contato. Confirmar?`)) return;
    onNaoContatar();
  }

  return (
    <div className="modal" onClick={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="wc-titulo">
        <div className="modal-head">
          <strong id="wc-titulo">Chamar {empresa.nome}</strong>
          <button className="btn-ghost sm" type="button" onClick={onFechar}>Fechar</button>
        </div>
        <div className="wc">
          <div>
            <label className="rotulo" htmlFor="wc-eu">Seu nome</label>
            <input id="wc-eu" value={eu} onChange={(e) => mudarNome(e.target.value)} placeholder="Como você quer se apresentar" />
          </div>
          <div>
            <span className="rotulo">Escolha uma abertura</span>
            <div className="chips">
              {MODELOS.map((m, i) => (
                <button key={m.nome} type="button" className="chip" aria-pressed={i === modelo} onClick={() => trocarModelo(i)}>
                  {m.nome}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="rotulo" htmlFor="wc-texto">Mensagem (edite à vontade)</label>
            <textarea id="wc-texto" ref={caixa} value={texto} onChange={(e) => { setTexto(e.target.value); setEditado(true); }} />
          </div>
          {contatosHoje >= LIMITE_DIARIO && (
            <p className="aviso">
              Você já abriu {contatosHoje} conversas hoje. Passar disso aumenta o risco de o WhatsApp bloquear seu número; vale continuar amanhã.
            </p>
          )}
          <div className="linha">
            <a className="btn-wa" href={linkWhatsApp(empresa.telefone, texto.trim())} target="_blank" rel="noopener" onClick={onAbriu}>
              Abrir no WhatsApp
            </a>
            <button className="btn-ghost" type="button" onClick={copiar}>{copiado ? "Copiado" : "Copiar mensagem"}</button>
            <button className="link-discreto" type="button" onClick={naoContatar}>Pediu para não receber mensagens</button>
          </div>
          <p className="dica">
            O WhatsApp abre com o texto pronto e <b>você</b> revisa e aperta enviar. Para não ser bloqueado: mensagem personalizada,
            poucos contatos por dia, nada de envio automático e parar na hora se a pessoa pedir.
          </p>
        </div>
      </div>
    </div>
  );
}
