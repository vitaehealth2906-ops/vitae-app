# Plano World-Class — vita id

## De nota 3 pra nota 10 em cada area

Data: 09/04/2026
Filosofia: HM-init — planejar tudo antes de tocar em qualquer coisa

---

## AREA 1 — Design Visual (hoje 7/10 → meta 10/10)

### O problema
O app e bonito tela por tela, mas cada tela foi feita independente. Resultado: 6 tab bars diferentes, 24 valores de arredondamento, cores repetidas 43 vezes em arquivos separados. E como ter 38 quartos bonitos mas cada um com um piso diferente.

### O que precisa mudar

**1.1 — Uma unica fonte de verdade visual**
O arquivo vitae-core.css ja existe com todos os tokens corretos. Porem NENHUMA tela importa ele. Cada tela tem seus proprios estilos colados dentro.

Acao: Cada uma das 38 telas precisa:
- Importar vitae-core.css
- Remover o CSS duplicado que ja existe no core
- Manter so o CSS especifico daquela tela (o que e unico dela)

Impacto: Mudar a cor verde do app de #00E5A0 pra qualquer outra cor = mudar 1 linha em 1 arquivo, nao 43 linhas em 38 arquivos.

**1.2 — Tab bar unica**
Hoje existem 6 implementacoes. Algumas usam <div>, outras <button>. Algumas tem indicador de ponto, outras nao. Funcoes diferentes (navigateTo vs nav).

Acao: Criar 1 componente de tab bar no vitae-core.css + 1 bloco de HTML padrao que todas as telas copiam identico. Uma funcao de navegacao padrao.

**1.3 — Arredondamento padronizado**
Hoje: 24 valores diferentes (4px, 5px, 6px, 7px, 8px, 9px, 10px, 12px, 14px, 16px, 18px, 20px...).

Acao: Definir 4 niveis e so:
- Pequeno: 8px (botoes pequenos, badges)
- Medio: 14px (cards, inputs)
- Grande: 20px (modais, bottom sheets)
- Redondo: 50% (avatares, indicadores)

**1.4 — Sombras padronizadas**
Hoje: cada tela tem sombras diferentes.

Acao: Definir 3 niveis:
- Sutil: cards normais
- Media: cards em destaque, modais
- Forte: elementos flutuantes (FAB, toast)

### Resultado esperado
Qualquer pessoa que abrir o app vai sentir que TODAS as telas foram feitas pela mesma equipe, no mesmo dia, com o mesmo cuidado. Zero inconsistencia.

---

## AREA 2 — Design System (hoje 3/10 → meta 10/10)

### O problema
O vitae-core.css existe mas e um arquivo morto. Nenhuma tela usa ele. E como ter um manual de marca guardado na gaveta enquanto cada designer faz o que quer.

### O que precisa mudar

**2.1 — vitae-core.css como lei do projeto**
Tudo que e visual e compartilhado deve estar la:
- Variaveis de cor (todas)
- Variaveis de espacamento (escala de 4px)
- Variaveis de arredondamento (4 niveis)
- Variaveis de sombra (3 niveis)
- Variaveis de tipografia (tamanhos e pesos)
- Componente: tab bar
- Componente: header de pagina (titulo com italico verde)
- Componente: botao de voltar
- Componente: card basico
- Componente: toast de notificacao
- Componente: empty state
- Componente: bottom sheet
- Componente: botao primario (gradiente)
- Componente: botao secundario (branco)
- Componente: input de texto
- Componente: badge/pill
- Componente: allergy tag
- Componente: medication card
- Animacoes compartilhadas (fadeUp, spin)
- Responsividade (mobile fullscreen)
- Reduced motion (acessibilidade)

**2.2 — Remover vitae-glass.css e vitae-light.css**
Esses dois arquivos existem mas criam conflito com os estilos inline. Tudo que e util neles deve ser absorvido pelo vitae-core.css. Depois, deletar.

**2.3 — Cada tela: so CSS unico**
Depois da migracao, cada tela HTML tera:
- 1 import: vitae-core.css
- CSS inline MINIMO: so o que e especifico daquela tela (ex: o ring SVG do Score, o card flip do RG)

### Resultado esperado
Um desenvolvedor novo abre o projeto e entende tudo em 5 minutos. "As cores estao aqui, os componentes estao aqui, cada tela so tem o que e dela."

---

## AREA 3 — Seguranca (hoje 4/10 → meta 10/10)

### O problema
6 pontos onde informacoes do servidor sao colocadas na tela sem limpar. Se alguem mal-intencionado envia um nome de medicamento com conteudo perigoso, ele pode executar comandos no navegador do paciente.

### O que precisa mudar

**3.1 — Sanitizar TUDO que vem do servidor**
Regra: nenhuma informacao do servidor vai direto pra tela. Toda informacao passa por uma funcao de limpeza antes.

Onde corrigir (6 pontos identificados):
1. 25-summary.html: foto do paciente
2. 08-perfil.html: foto do usuario + nome na tag
3. 08-perfil.html: condicoes de saude
4. 20-medico-dashboard.html: busca de pacientes
5. pre-consulta.html: resposta da IA
6. 20-medico-dashboard.html: opcoes de edicao

Acao: Criar uma funcao sanitize() no api.js que limpa qualquer texto antes de colocar na tela. Usar essa funcao em TODOS os pontos acima.

**3.2 — Tokens mais seguros**
Hoje os tokens de login ficam no localStorage, que pode ser acessado por scripts maliciosos (se o XSS acima nao for corrigido).

Acao: Depois de corrigir o XSS, o localStorage e aceitavel. Mas adicionar:
- Verificacao de expiracao do token no frontend
- Logout automatico se o token expirar e o refresh falhar

**3.3 — Validacao de dados no frontend**
Nada que vem do servidor pode ser confiado cegamente. Antes de usar qualquer dado:
- Verificar se e do tipo esperado (texto e texto, numero e numero)
- Verificar se nao esta vazio quando deveria ter conteudo
- Limitar tamanho (um nome de medicamento nao pode ter 10.000 caracteres)

### Resultado esperado
Mesmo que um atacante tente injetar conteudo malicioso, o app bloqueia. O paciente nunca e exposto.

---

## AREA 4 — Tratamento de Erros (hoje 2/10 → meta 10/10)

### O problema
10+ telas nao tem nenhum tratamento quando algo da errado (internet cai, servidor nao responde, dados invalidos). O paciente fica olhando pra tela sem saber o que aconteceu.

### O que precisa mudar

**4.1 — Regra universal: toda acao tem 3 estados**
Toda acao que o paciente faz (tocar um botao, enviar dados, carregar tela) precisa ter:
1. Estado de CARREGANDO (spinner, botao desabilitado, texto "Aguarde...")
2. Estado de SUCESSO (toast verde, redirecionamento, confirmacao)
3. Estado de ERRO (mensagem clara + botao de tentar de novo)

Se algum desses 3 nao existe, a tela esta incompleta.

**4.2 — Componente de erro padrao**
Criar no vitae-core.css um componente de erro reutilizavel:
- Icone de atencao
- Mensagem em linguagem simples ("Nao foi possivel conectar. Verifique sua internet")
- Botao "Tentar novamente"
- Opcao secundaria ("Ou tente mais tarde")

**4.3 — Protecao contra duplo-clique**
Toda acao que envia dados ao servidor:
- Desabilita o botao imediatamente apos o primeiro toque
- Mostra spinner ou texto "Aguarde"
- So reabilita depois de receber resposta (sucesso ou erro)

**4.4 — Telas que precisam de correcao (lista completa)**

| Tela | O que falta |
|------|-------------|
| 03-cadastro | Erro no cadastro, loading no botao |
| 04-verificacao | Erro no SMS, loading na verificacao |
| 05-quiz | Erro ao salvar quiz |
| 08-perfil | Erro ao carregar perfil, medicamentos, alergias, exames |
| 09-dados-pessoais | Erro ao salvar campos |
| 10-score | Erro ao carregar score |
| 11-exames-lista | Erro ao carregar exames |
| 14-esqueci-senha | Erro ao enviar email |
| 15-nova-senha | Erro ao salvar senha |
| 16-medicamentos | Erro ao carregar/adicionar/remover medicamento |
| 17-alergias | Erro ao carregar/adicionar/remover alergia |
| 20-medico-cadastro | Erro ao criar perfil medico |
| 22-autorizacao | Erro ao autorizar/revogar |
| 23-agendamentos | Erro ao criar/deletar agendamento |
| 26-scan-receita | Erro na camera + fallback claro |
| 27-processando | Timeout + erro do servidor |
| 28-revisao-receita | Erro ao confirmar medicamentos |
| 30-lembretes | Erro ao carregar medicamentos |
| 31-revisao-alergias | Erro ao confirmar alergias |

### Resultado esperado
Nao importa o que de errado — internet, servidor, dados — o paciente SEMPRE ve uma mensagem clara e tem um caminho pra seguir. Nunca fica perdido.

---

## AREA 5 — Integridade de Dados (hoje 3/10 → meta 10/10)

### O problema
1. Dados de demonstracao sao mostrados como se fossem reais quando o scan falha
2. Lembretes "tomados" sao salvos so no celular e podem desaparecer
3. Dados de scan passados entre telas podem se perder

### O que precisa mudar

**5.1 — ELIMINAR dados de demonstracao do app**
Esse e o app REAL, nao uma demo. Se o scan falha:
- Mostrar mensagem de erro: "Nao conseguimos identificar os medicamentos"
- Oferecer opcoes: "Tentar de novo" / "Tirar outra foto" / "Digitar manualmente"
- NUNCA mostrar Loratadina, Prednisolona, Soro Fisiologico como resultado

Remover dados demo de:
- 28-revisao-receita.html (array fixo de 4 medicamentos)
- 31-revisao-alergias.html (array fixo de 4 alergias)
- 30-lembretes.html (schedule fixo de 5 lembretes)
- 29-confirmacao.html (lembretes fixos)

**5.2 — Lembretes salvos no servidor**
Hoje: localStorage (some se limpar cache)
Meta: Salvar no servidor via API + manter cache local pra performance

Precisaria criar:
- Nova tabela no banco: "doses_tomadas" (medicamento_id, data_hora, status)
- Nova rota: POST /medicamentos/dose-tomada
- Nova rota: GET /medicamentos/doses-hoje
- Frontend: ao marcar "tomei", salva no servidor E no localStorage

**5.3 — Validacao de navegacao entre telas**
Cada tela do fluxo de scan deve verificar se tem os dados necessarios:
- 27-processando: "Tenho a foto no sessionStorage?" Se nao → volta pra 16-medicamentos
- 28-revisao-receita: "Tenho o resultado do scan?" Se nao → volta pra 16-medicamentos
- 29-confirmacao: "Medicamentos foram realmente adicionados?" Se nao → volta pra 16-medicamentos
- 30-lembretes: "Paciente esta logado?" Se nao → volta pro login

**5.4 — Limpeza de dados temporarios**
Apos o fluxo de scan completar (medicamentos adicionados):
- Limpar sessionStorage (foto, resultado, tipo)
- Nao deixar dados orfaos que possam confundir o proximo scan

### Resultado esperado
Os dados do paciente sao sagrados. Nunca se perdem, nunca sao falsos, nunca aparecem pela metade. Se algo da errado, o paciente sabe e tem controle.

---

## AREA 6 — Prontidao pra Lancamento (hoje 3/10 → meta 10/10)

### O que precisa existir antes de um paciente real usar

**6.1 — Fluxo de scan real (sem dados demo)**
O pipeline de 3 camadas (barcode → OCR → manual) descrito no objetivo-implementacao.md

**6.2 — Tabela CMED importada**
15.000+ medicamentos brasileiros no banco de dados. Sem isso, o barcode e o autocomplete nao funcionam.

**6.3 — Quiz adaptativo**
O formato de quiz conversacional (descrito no objetivo-implementacao.md) em vez de lista estatica com toggles.

**6.4 — Educacao do usuario na camera**
Onboarding de scan na primeira vez + moldura inteligente com feedback em tempo real.

**6.5 — Backend atualizado e estavel**
- Rotas de scan funcionando com timeout adequado
- Tabela CMED no banco
- Rota de doses tomadas
- Deploy estavel (Railway ou alternativa)

**6.6 — Testes de qualidade (HM-QA)**
Antes de lancar, testar:
- Scan com 10 fotos reais de medicamentos brasileiros
- Scan com 5 fotos ruins (escura, borrada, cortada)
- Login + scan + confirmar + lembrete: fluxo completo sem erro
- Alerta de alergia quando medicamento conflita
- Comportamento offline (sem internet)
- Duplo-clique em todos os botoes
- Troca de celular (dados persistem?)

---

## ORDEM DE EXECUCAO

Baseado na filosofia HM-init ("custo do futuro com juros"), a ordem CORRETA e:

### FASE 0 — Fundacao (resolve tudo que e estrutural)
1. Atualizar vitae-core.css com TODOS os componentes
2. Migrar TODAS as 38 telas pra usar vitae-core.css
3. Eliminar vitae-glass.css e vitae-light.css
4. Padronizar tab bar (1 componente, 1 funcao)
5. Padronizar arredondamento (4 niveis)
6. Padronizar sombras (3 niveis)

*Por que primeiro:* Qualquer mudanca visual feita DEPOIS disso e feita 1 vez em 1 lugar. Se fizermos as outras fases antes, cada correcao precisa ser repetida em 38 arquivos.

### FASE 1 — Seguranca (resolve tudo que e perigoso)
7. Criar funcao sanitize() no api.js
8. Aplicar sanitize() nos 6 pontos de XSS
9. Validar dados do servidor antes de usar
10. Proteger contra duplo-clique

### FASE 2 — Integridade (resolve tudo que e dado errado)
11. Remover TODOS os dados de demonstracao
12. Adicionar tratamento de erro em TODAS as telas (19 telas listadas)
13. Adicionar loading state em todos os botoes
14. Validar sessionStorage entre telas do fluxo de scan
15. Limpar dados temporarios apos conclusao

### FASE 3 — Funcionalidade (implementar o que falta)
16. Importar tabela CMED pro banco de dados
17. Implementar leitura de barcode (html5-qrcode)
18. Implementar pipeline de 3 camadas (barcode → OCR → manual)
19. Implementar quiz adaptativo
20. Implementar educacao do usuario na camera
21. Implementar persistencia de lembretes no servidor

### FASE 4 — Qualidade (testar tudo)
22. Testar scan com fotos reais
23. Testar fluxo completo (login → scan → confirmar → lembrete)
24. Testar cenarios de erro
25. Testar offline
26. Testar em diferentes celulares
27. Corrigir bugs encontrados

---

## TABELA DE NOTAS APOS CADA FASE

| Area | Hoje | Apos Fase 0 | Apos Fase 1 | Apos Fase 2 | Apos Fase 3 | Apos Fase 4 |
|------|------|-------------|-------------|-------------|-------------|-------------|
| Design Visual | 7 | 10 | 10 | 10 | 10 | 10 |
| Design System | 3 | 10 | 10 | 10 | 10 | 10 |
| Seguranca | 4 | 4 | 10 | 10 | 10 | 10 |
| Tratamento de Erros | 2 | 2 | 2 | 10 | 10 | 10 |
| Integridade de Dados | 3 | 3 | 3 | 10 | 10 | 10 |
| Prontidao Lancamento | 3 | 3 | 4 | 6 | 9 | 10 |

---

## ESTIMATIVA DE ESFORCO

| Fase | Conversas necessarias | Depende de |
|------|----------------------|------------|
| Fase 0 (Fundacao) | 3-4 conversas | Nada — comeca agora |
| Fase 1 (Seguranca) | 1-2 conversas | Fase 0 |
| Fase 2 (Integridade) | 2-3 conversas | Fase 0 + 1 |
| Fase 3 (Funcionalidade) | 4-5 conversas | Fase 0 + 1 + 2 |
| Fase 4 (Qualidade) | 1-2 conversas | Fase 0 + 1 + 2 + 3 |
| **Total** | **~12-16 conversas** | |

---

## O OBJETIVO FINAL

Quando tudo estiver feito, o vita id sera:
- Um app onde QUALQUER mudanca visual e feita em 1 arquivo
- Um app onde NENHUM dado falso aparece pro paciente
- Um app onde QUALQUER erro e tratado com mensagem clara
- Um app onde o paciente escaneia uma caixa de remedio e em 3 toques esta tudo salvo
- Um app que um investidor olha e pensa "isso aqui foi feito por uma equipe seria"
- Um app que passa numa auditoria de seguranca
- Um app que funciona offline pra busca de medicamentos
- Um app que um medico confia o suficiente pra recomendar pro paciente

Isso e nota 10. Isso e world-class. Isso e Higher Mind.
