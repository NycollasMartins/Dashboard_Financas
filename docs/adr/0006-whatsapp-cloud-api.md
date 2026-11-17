# ADR-0006 · WhatsApp Cloud API oficial, sem grupos; Telegram como alternativa

**Status:** Aceita · **Decisor:** Arquiteto

## Contexto
- Exigência: API **oficial** da Meta, conversas iniciadas pelo usuário.
- Preço da Meta (modelo por mensagem desde jul/2025): mensagens de **serviço** (respostas dentro da
  janela de 24 h após o usuário escrever) são **gratuitas**. Como o bot só responde, o custo esperado é
  **zero**. ⚠️ Mensagens proativas (lembretes de fatura) exigiriam *templates* pagos → não usaremos;
  lembretes irão pelo Telegram ou pelo PWA. **Confirmar a tabela de preços vigente antes da Fase 6.**
- **Grupos**: a *Groups API* da Cloud API existe, mas em 2026 está liberada apenas para empresas com
  **Official Business Account (OBA)** (selo verificado), com limite de 8 participantes e sem botões
  interativos. Para uso pessoal **não é viável**.

## Decisão
- Conversa **privada** de cada pessoa com o número do bot; cada número vinculado a um usuário.
- Para lançar na família, o bot usa o **espaço padrão** do vínculo (configurável) ou o comando "família: …".
- **Telegram** como canal alternativo gratuito (bots e grupos liberados), mesmo `MessageService` (ADR-0004).
- Número do bot: o número de teste gratuito da Meta serve para desenvolvimento (até 5 destinatários
  cadastrados); em produção, um chip/número dedicado (pode ter custo de linha — avisaremos na Fase 6).
