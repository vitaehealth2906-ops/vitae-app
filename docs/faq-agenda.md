# FAQ — Agenda do Médico (vita id)

Versão 1.0 · 2026-04-26

---

## Configuração

### Como conecto meu Google Calendar?
Vai em Agenda → Configurações → Google Calendar → Conectar. Você é redirecionado pra tela do Google, autoriza a permissão (somente leitura) e volta pro vita id. Pronto. Os eventos pessoais aparecem como blocos cinza-listrado "Ocupado · Google" na sua agenda. **vita id NUNCA escreve no seu Google.**

### O Google vai bagunçar minha agenda pessoal?
Não. A integração é **somente leitura**. vita id lê seus eventos pra mostrar como ocupado. Nunca cria, edita ou apaga nada no Google. Sua agenda pessoal fica intacta.

### Posso usar dois Google Calendars (pessoal + clínica)?
Na v1.0 só um (o primário). Se você precisa de mais, me avisa que entra na v1.1.

### Como mudo a duração padrão das consultas?
Agenda → Configurações → Duração padrão. Aceita qualquer número entre 10 e 120 minutos. Vale como sugestão — você sempre pode mudar consulta a consulta.

---

## Secretária

### Como adiciono uma secretária?
Agenda → Configurações → Secretárias → Convidar. Digita o email dela, escolhe permissões (default: ver e marcar consultas + lista de espera). Ela recebe email com link, cria conta dela ou loga, e está dentro.

### Ela vê meu briefing dos pacientes?
**Não.** A secretária vê: nome do paciente, telefone, horário, tipo da consulta, local. Ela **não** vê briefing clínico, exames, alergias, medicamentos ou observações clínicas. O sistema bloqueia automaticamente.

### Como removo o acesso dela?
Mesma tela de secretárias → Revogar. Acesso some imediatamente.

### O convite expira?
Sim, em 7 dias. E é de uso único — depois que ela aceita, o link não funciona mais.

---

## Lembretes

### Quando o paciente recebe lembrete?
24 horas antes e 2 horas antes da consulta. Por email e push (se ele instalou o vita id no celular).

### Posso desativar lembretes pra um paciente específico?
Sim. Cada email de lembrete tem link "não quero mais receber". Quando o paciente clica, o sistema desativa pra ele.

### Posso desativar todos os lembretes?
Sim. Configurações → Lembretes → desliga 24h, 2h, ou ambos.

### O paciente idoso recebe SMS?
Na v1.0 não. Os canais são email e push. Se o paciente não tem nenhum dos dois, o sistema mostra um alerta "lembrar manualmente" pra você ou sua secretária.

### Quanto custa enviar lembretes?
**Zero**. Email pelo Resend (até 3000/mês grátis) e push web (zero custo sempre).

---

## Marcação e cancelamento

### Como cancelo uma consulta?
Clica no slot → Cancelar. Aparece um toast com botão "Desfazer" por 10 segundos. Se foi sem querer, clica desfazer e volta tudo.

### O paciente recebe aviso quando cancelo?
Sim, automaticamente por email. Se você desfaz dentro de 10 segundos, **nenhum** aviso é enviado.

### Como marco retorno depois de atender?
No briefing do paciente, clica **"Finalizar e marcar retorno"** (botão verde). A agenda abre direto na semana sugerida (+15 dias por padrão), com o melhor horário marcado com ★. Você clica, confirma, pronto. 1 clique.

### Posso mudar o prazo do retorno?
Sim. No banner que aparece em cima da agenda, clica "alterar prazo" e escolhe 7, 30 dias ou data customizada.

---

## No-show e faltas

### O sistema marca falta automaticamente?
Sim, às 23h do dia. Se você esqueceu de marcar comparecimento ou falta, o sistema assume FALTA. Você tem 7 dias pra reverter.

### O que acontece se um paciente falta 2 vezes?
Próxima marcação dele ganha um chip "confirmar 48h antes". Sua secretária liga 2 dias antes pra confirmar.

---

## Dados e privacidade

### Como exporto meus dados?
Agenda → Stats → Exportar CSV. Baixa tudo do mês. Para exportar tudo, vai em Perfil → Meus Dados → Exportar (todos os slots, todas as consultas).

### O que acontece se eu apagar minha conta?
Seus pacientes não conseguem ver suas consultas marcadas. O histórico clínico fica preservado por 20 anos (CFM). Recomendamos avisar pacientes antes de excluir.

### Meus dados estão seguros?
Sim. Criptografia em trânsito (HTTPS) e em repouso (Supabase). Token do Google encriptado AES-256. Logs sem dados clínicos. Audit imutável de quem fez o quê.

---

## Problemas

### Esqueci de finalizar uma consulta. E agora?
Sem problema. No dashboard, pacientes "respondidos há mais de 1 semana" aparecem destacados. Clica e finaliza.

### Cliquei errado, como desfaço?
Tudo destrutivo (cancelar, finalizar) tem botão Desfazer no toast por 10 segundos. Se passou esse tempo, dá pra remarcar/refinalizar.

### Estou viajando pra outro fuso horário, vai bagunçar?
Não. Os horários são sempre exibidos no fuso do consultório (São Paulo por padrão). Aparece um banner avisando "você está em fuso diferente" pra você não confundir.

### A internet caiu, e eu tenho paciente na sala?
Você continua vendo a agenda dos próximos 14 dias (cache offline). Aparece banner "modo leitura" — você não consegue editar até voltar a internet, mas tem informação.

### O sistema travou, perdi alguma coisa?
Difícil. Tudo é salvo no servidor com `attemptId` único — se você clicou Salvar e travou, ao tentar de novo o sistema reconhece e não duplica. Cancelamentos pendentes ficam na fila e sincronizam quando voltar online.

---

## Suporte

Algum problema? Manda email pra suporte@vitaehealth.com com:
- O que você fazia
- O que aconteceu
- Print da tela (se possível)

Resposta em até 24h úteis.
