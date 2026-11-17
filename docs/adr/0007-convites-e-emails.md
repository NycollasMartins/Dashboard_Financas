# ADR-0007 · Convites por link compartilhável; SMTP próprio gratuito em produção

**Status:** Aceita · **Decisor:** Arquiteto

## Contexto
O SMTP padrão do Supabase é só para testes: limite de poucos e-mails por hora e, nos projetos atuais,
só entrega para endereços da equipe do projeto. Cadastro e recuperação de senha **precisam** de e-mail.

## Decisão
1. **Convites não dependem de e-mail**: o admin gera um link de uso único e envia por WhatsApp
   (botão "Enviar pelo WhatsApp" usa `wa.me`, sem API, custo zero).
2. **E-mails do Auth** (confirmação, recuperação) em produção via **SMTP próprio gratuito**:
   - **Brevo** (plano gratuito com ~300 e-mails/dia; permite remetente verificado sem domínio próprio), ou
   - **Resend** (plano gratuito; exige domínio próprio — um `.com.br` custa ~R$ 40/ano, **opcional**).
   Recomendação: **Brevo**, custo zero sem domínio.
3. Links de e-mail usam **`token_hash`** (templates em `supabase/templates/`), funcionando mesmo se o
   e-mail for aberto em outro dispositivo.
