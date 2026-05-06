# Fase 13 — Checklist de Cutover A/B

**Data alvo:** quando médico betatester estiver disponível
**Tempo total:** 7-10 dias

---

## Pré-requisitos (validar ANTES de começar Fase 13)

- [ ] Backup Supabase < 24h (`d:/vitae-app-novo/backups/`)
- [ ] `app-legacy-2026-05-05.html` testado em produção via `/desktop/legacy`
- [ ] `app-v2.html` testado localmente (`http://localhost:3000/desktop/01-login.html`)
- [ ] Bateria Playwright `node tests/smoke-master.js` passa 100%
- [ ] Sentry configurado com alertas (email Lucas)
- [ ] Métricas baseline coletadas (PCs/dia, login/dia, latência)
- [ ] Médico betatester identificado, disponível 5 dias úteis
- [ ] WhatsApp do Lucas pronto pra suporte ao betatester

---

## Estratégia A/B — 4 estágios

| Estágio | % usuários no novo | Duração | Critério para avançar | Critério rollback |
|---|---|---|---|---|
| **Beta interno** | Lucas + 1 médico | 5 dias úteis | NPS ≥ 8, ≤ 2 bugs críticos pendentes | Crítico ou desistência |
| **Canário** | 10% | 48h | Sentry estável, métricas iguais | Error rate > 0.5% |
| **Metade** | 50% | 72h | Mesmo critério | Idem |
| **Total** | 100% | indefinido | 7 dias estáveis | Idem |

---

## Implementação A/B (já pronta)

**Estado atual:**
- `vercel.json` rewrite `/desktop` → `app-v2-html` (default novo)
- `vercel.json` rewrite `/desktop/legacy` → `app-legacy-2026-05-05.html` (rollback manual)
- Toggle no Perfil → `voltarParaLegacy()` salva `localStorage.vitae_usar_legacy=1`
- Auth gate do `app-v2.html` honra esse localStorage no boot

**Pra ativar A/B real (10% → 50% → 100%):**

Editar `vercel.json` adicionando middleware ou usar feature flag externa (LaunchDarkly / GrowthBook). Ou solução mais simples sem dependência externa:

```js
// No <head> do desktop/01-login.html, antes do redirect pra app-v2
(function(){
  var u = JSON.parse(localStorage.getItem('vitae_usuario')||'{}');
  if (!u.id) return;
  // Hash determinístico por userId — sticky por sessão
  var h = 0;
  for (var i = 0; i < u.id.length; i++) h = (h*31 + u.id.charCodeAt(i)) | 0;
  var pct = Math.abs(h) % 100; // 0-99
  // ROLLOUT_PERCENT controla a fatia que vai pro app-v2
  var ROLLOUT = parseInt(localStorage.getItem('vitae_rollout_pct') || '100', 10);
  if (pct >= ROLLOUT) {
    window.location.replace('app-legacy-2026-05-05.html');
    return;
  }
})();
```

Para mudar a porcentagem: setar `vitae_rollout_pct` global (via console do Lucas, ou via flag remota futura).

---

## Roteiro do betatester (5 dias úteis)

**Dia 0 — Onboarding (60 min)**
- Reunião de 60 min: explica o app, pede pra usar normalmente
- Lucas instala o app no PC do médico (acesso `vitae-app.vercel.app/desktop/`)
- Marcador `localStorage.vitae_usar_legacy = '0'` pra forçar versão nova
- Linha direta de WhatsApp do Lucas

**Dia 1-5 — Uso real**
- Médico usa pra atender pacientes reais
- Cada bug que ele relatar: Lucas anota + decide se conserta no quente ou aceita débito

**Dia 6 — Reunião feedback (60 min)**
- Tempo médio em cada tela
- Ações concluídas vs abandonadas
- Bugs encontrados (severidade)
- Frustrações verbalizadas
- Sugestões
- **NPS 0-10**: "Quanto você recomenda VITAE pra outro médico?"

**Critério avanço pra canário:**
- NPS ≥ 8
- ≤ 2 bugs críticos pendentes
- Médico afirma que vai continuar usando

---

## Comunicado pra 100% (preparado)

**Assunto:** Nova versão do VITAE Médico disponível

**Corpo:**

> Olá Dr(a). [Nome],
>
> A nova versão do VITAE Médico está disponível pra você. Mudanças principais:
>
> - **Painel Tempo & Receita** — veja quanto tempo economiza com pré-consultas
> - **IA Collab** (opt-in) — compara anamneses anteriores do mesmo paciente
> - **Possíveis urgências detectadas** — sinais sutis na voz do paciente, sempre com confirmação clínica
> - **Templates com phone preview real** — você vê exatamente como o paciente vai responder
> - **Disparo de lembretes em massa** via WhatsApp
>
> Se preferir continuar com a versão anterior, é só clicar em "Voltar pra versão antiga" no seu Perfil. Mantemos as duas versões disponíveis pelos próximos 90 dias.
>
> Qualquer dúvida ou problema, fala comigo direto: [WhatsApp].
>
> Lucas Borelli — VITAE

---

## Rollback de emergência (executar em < 5 min)

```bash
# 1. Editar vercel.json
sed -i 's|"destination": "/desktop/01-login.html"|"destination": "/desktop/login.html"|g' vercel.json

# 2. Commit + push
git commit -am "rollback emergencial: voltar pra desktop legacy" && git push

# 3. Esperar Vercel deploy (60-90s)
curl -s https://vitae-app.vercel.app/desktop/ | grep -c "vita id" # validar
```

Comunicar imediatamente o betatester via WhatsApp + email.

---

## Métricas pós-cutover

Acompanhar diariamente nos primeiros 30 dias:

```sql
-- PCs/dia (deve estar igual ou maior que antes)
SELECT respondida_em::date, COUNT(*)
FROM pre_consultas
WHERE respondida_em > NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1;

-- Logins/dia
SELECT criado_em::date, COUNT(*)
FROM refresh_tokens
WHERE criado_em > NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1;

-- Distribuição de versão (proxy: contar acessos por endpoint)
-- (Requer log no Vercel ou Sentry)
```

---

## Critério de "cutover bem-sucedido" (após 100%)

- 7 dias consecutivos com error rate < 0.5%
- PCs/dia igual ou maior que baseline pré-cutover
- 0 queixas críticas de médicos
- Sentry sem novos issues recorrentes

Quando todos forem true por 7 dias: **Fase 13 fechada** → entra **Fase 14 (90 dias estabilização)**.
