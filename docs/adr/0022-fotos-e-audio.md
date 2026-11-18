# ADR-0022 · Fotos (comprovantes) e áudio: a IA só extrai/transcreve; nada de arquivo guardado

- **Status:** Aceita (18/11/2026) — antecipa para a Fase 6 a "leitura de prints" (Fase 7 fica só CSV/OFX)
- **Decisores:** dono do produto, Arquiteto, Segurança, IA

## Decisão
1. **Foto** (Telegram ou Assistente do app — no iPhone `capture="environment"` abre a câmera): Gemini
   3.1 Flash-Lite (multimodal, gratuito) **só extrai** campos (`media/receipt.ts`): tipo de documento,
   estabelecimento, total, data, forma de pagamento, final do cartão, itens, confiança por campo.
   O schema **não tem** campo para CPF/CNPJ/contato e o sistema ainda remove esses padrões (`scrubPII`).
2. **Validação no sistema**: valor > 0; soma dos itens × total (alerta acima de R$ 0,05); data plausível
   (futura/absurda → hoje com alerta; > 60 dias → alerta); possível **duplicata** (mesmo valor ±2 dias);
   cartão pelo final (`credit_cards.last4`); categoria pela regra aprendida/sinônimos e depois a sugestão da IA.
3. **Foto SEMPRE pede confirmação**, mostrando o que foi lido. Opções: um único gasto, **dividir por categoria**
   (só quando a soma dos itens fecha com o total), editar campos, cancelar. Ilegível/não comprovante → dicas.
4. **Áudio**: Groq **Whisper** `whisper-large-v3` (gratuito; ogg/opus do Telegram, webm do Chrome, mp4 do
   Safari iOS), `language=pt` + dica de vocabulário; reserva: Gemini. Máx. **60 s**. Resposta "Entendi: '…'" e o
   texto segue o **mesmo** fluxo e as **mesmas** regras de confirmação do texto.
5. **Privacidade**: imagem/áudio processados **em memória** e descartados; foto reduzida no aparelho (≤ 1600 px,
   JPEG) antes de sair; no Telegram usa-se a versão ≤ 1600 px. Auditoria guarda **só** a extração/transcrição
   (`assistant_actions.input_kind` = `photo`/`audio`, `original_text` = "[foto] …" ou a transcrição).
6. **Cota**: foto e áudio têm cotas próprias por usuário/dia (`gemini-image` 15, `groq-audio`/`gemini-audio` 30)
   além do rate limit por minuto; limites de tamanho antes de chamar a IA (4 MB imagem, 2,5 MB áudio).

## Consequências
- (+) Lançar uma nota de mercado+farmácia vira 2 lançamentos certos em 3 toques.
- (−) No gratuito, o Google pode usar as imagens enviadas para melhorar produtos → aviso na tela e no README;
  recomendação de não fotografar documentos.
