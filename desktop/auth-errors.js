/**
 * VITAE Desktop — Sistema de tradução e exibição de erros do fluxo de autenticação médica.
 *
 * Uso:
 *   const info = vitaeAuthError.traduzir({ res, data, contexto, network, exception });
 *   vitaeAuthError.mostrar(elemento, info);
 *   vitaeAuthError.limpar(elemento);
 *
 * Contextos suportados: 'login', 'cadastro', 'quiz', 'foto', 'salvar-medico', 'sessao'.
 */
(function(global){
  'use strict';

  // -------- Dicionário de campos -> rótulo amigável --------
  const CAMPOS_AMIGAVEIS = {
    nome: 'Nome completo',
    email: 'E-mail',
    celular: 'Celular',
    senha: 'Senha',
    tipo: 'Tipo de conta',
    crm: 'CRM',
    ufCrm: 'UF do CRM',
    especialidade: 'Especialidade',
    clinica: 'Nome da clínica',
    enderecoClinica: 'Endereço',
    telefoneClinica: 'Telefone da clínica',
    valorConsulta: 'Valor da consulta',
    refreshToken: 'Sessão',
    token: 'Token de acesso',
    novaSenha: 'Nova senha',
    codigo: 'Código de verificação'
  };

  function rotuloCampo(p){
    if (!p) return 'Campo';
    const nome = Array.isArray(p) ? p[p.length-1] : String(p);
    return CAMPOS_AMIGAVEIS[nome] || nome.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
  }

  // -------- Mensagens padrão por status HTTP e contexto --------
  const MENSAGENS = {
    400: {
      login:    { titulo: 'Dados inválidos', msg: 'Verifique e-mail e senha.' },
      cadastro: { titulo: 'Dados inválidos', msg: 'Confira os campos e tente novamente.' },
      quiz:     { titulo: 'Dados inválidos', msg: 'Confira os campos do passo atual.' },
      default:  { titulo: 'Dados inválidos', msg: 'Confira os campos e tente novamente.' }
    },
    401: {
      login:    { titulo: 'E-mail ou senha incorretos', msg: 'Confira suas credenciais. Se esqueceu, use "Esqueci minha senha".' },
      default:  { titulo: 'Sua sessão expirou', msg: 'Faça login novamente para continuar.', acao: { rotulo: 'Ir para login', href: '01-login.html', limparSessao: true } }
    },
    403: {
      login:    { titulo: 'Conta inativa', msg: 'Sua conta foi desativada. Entre em contato com o suporte.' },
      default:  { titulo: 'Acesso negado', msg: 'Você não tem permissão para esta ação.' }
    },
    404: {
      quiz:     { titulo: 'Sessão inválida', msg: 'Seu cadastro foi removido ou expirou. Faça login novamente.', acao: { rotulo: 'Ir para login', href: '01-login.html', limparSessao: true } },
      default:  { titulo: 'Recurso não encontrado', msg: 'A informação solicitada não está mais disponível.' }
    },
    409: {
      cadastro: { titulo: 'Conta já existe', msg: 'Já existe uma conta com este e-mail ou celular.', acao: { rotulo: 'Ir para login', href: '01-login.html' } },
      quiz:     { titulo: 'Perfil já cadastrado', msg: 'Seu perfil médico já foi criado anteriormente. Vamos atualizar.' },
      default:  { titulo: 'Conflito', msg: 'Esse dado já está em uso.' }
    },
    410: {
      default:  { titulo: 'Link expirado', msg: 'Este link não é mais válido. Solicite um novo.' }
    },
    413: {
      foto:     { titulo: 'Imagem muito grande', msg: 'A foto excede o limite de 2 MB. Tente uma imagem menor.' },
      default:  { titulo: 'Arquivo muito grande', msg: 'O arquivo excede o limite permitido.' }
    },
    415: {
      foto:     { titulo: 'Formato não suportado', msg: 'Use uma imagem em JPG ou PNG.' },
      default:  { titulo: 'Formato não suportado', msg: 'Esse tipo de arquivo não é aceito.' }
    },
    422: {
      default:  { titulo: 'Não foi possível processar', msg: 'Os dados estão corretos mas o servidor não conseguiu salvar. Tente novamente.' }
    },
    429: {
      default:  { titulo: 'Muitas tentativas', msg: 'Aguarde alguns segundos e tente novamente.' }
    },
    500: { default: { titulo: 'Erro interno do servidor', msg: 'Algo deu errado do nosso lado. Suas informações foram preservadas. Tente novamente em alguns segundos.' } },
    502: { default: { titulo: 'Servidor indisponível', msg: 'Nosso servidor está temporariamente fora do ar. Tente novamente em alguns segundos.' } },
    503: { default: { titulo: 'Serviço em manutenção', msg: 'Estamos fazendo um ajuste rápido. Tente novamente em até 1 minuto.' } },
    504: { default: { titulo: 'Servidor demorou demais', msg: 'A resposta demorou mais que o esperado. Tente novamente.' } }
  };

  // -------- Tradução de erros do Zod e Prisma --------
  function traduzirZod(detalhes){
    if (!Array.isArray(detalhes) || !detalhes.length) return null;
    const partes = detalhes.map(d => {
      const campo = rotuloCampo(d.path || d.campo);
      const m = (d.mensagem || d.message || '').toLowerCase();
      // Heurísticas comuns
      if (m.includes('email') && m.includes('inv'))   return campo + ': formato de e-mail inválido';
      if (m.includes('celular') && m.includes('+55')) return campo + ': use o formato (DD) 99999-9999';
      if (m.includes('min') && m.includes('senha'))   return campo + ': mínimo 8 caracteres';
      if (m.includes('crm'))                          return campo + ': inválido (apenas números, 4 a 20 dígitos)';
      if (m.includes('uf'))                           return campo + ': selecione um estado';
      if (m.includes('positiv'))                      return campo + ': deve ser maior que zero';
      return campo + ': ' + (d.mensagem || d.message || 'inválido');
    });
    return partes.join(' · ');
  }

  // -------- Função principal de tradução --------
  /**
   * @param {Object} arg
   * @param {Response} [arg.res]     - resposta fetch
   * @param {Object}   [arg.data]    - corpo já parseado
   * @param {string}   [arg.contexto] - 'login' | 'cadastro' | 'quiz' | 'foto' | 'salvar-medico' | 'sessao'
   * @param {boolean}  [arg.network] - true se foi falha de rede (fetch lançou)
   * @param {Error}    [arg.exception] - exceção bruta
   * @returns {{titulo:string, msg:string, severidade:'error'|'warn'|'info', acao?:{rotulo:string,href?:string,onClick?:Function,limparSessao?:boolean}}}
   */
  function traduzir(arg){
    arg = arg || {};
    const ctx = arg.contexto || 'default';

    // Falha de rede (fetch lançou ou response.ok=false sem JSON)
    if (arg.network || (!arg.res && arg.exception)) {
      const m = (arg.exception && arg.exception.name) || '';
      if (m === 'AbortError' || /timeout/i.test(arg.exception && arg.exception.message || '')) {
        return { titulo: 'Servidor demorou demais', msg: 'A resposta demorou mais que o esperado. Tente novamente.', severidade: 'warn', acao: { rotulo: 'Tentar de novo', recarregar: true } };
      }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return { titulo: 'Sem conexão com a internet', msg: 'Verifique seu Wi-Fi ou dados móveis e tente novamente.', severidade: 'error', acao: { rotulo: 'Tentar de novo', recarregar: true } };
      }
      return { titulo: 'Sem conexão com o servidor', msg: 'Verifique sua internet ou tente novamente em alguns segundos.', severidade: 'error', acao: { rotulo: 'Tentar de novo', recarregar: true } };
    }

    const res = arg.res || {};
    const data = arg.data || {};
    const status = res.status || 0;

    // Detalhes Zod ganham prioridade quando 400
    if (status === 400 && data.detalhes && Array.isArray(data.detalhes) && data.detalhes.length) {
      const traduzido = traduzirZod(data.detalhes);
      if (traduzido) {
        return { titulo: 'Confira os campos', msg: traduzido, severidade: 'error' };
      }
    }

    // Mensagem específica do backend
    const erroBackend = (data && (data.erro || data.message)) || '';

    // Heurística por mensagem do backend mesmo em outros status
    if (erroBackend) {
      const lower = erroBackend.toLowerCase();
      if (lower.includes('ja existe uma conta com este email') || lower.includes('já existe uma conta com este email')) {
        return { titulo: 'Já existe conta com este e-mail', msg: 'Tente entrar com sua senha atual ou recuperar a senha.', severidade: 'warn', acao: { rotulo: 'Ir para login', href: '01-login.html' } };
      }
      if (lower.includes('ja existe uma conta com este celular') || lower.includes('já existe uma conta com este celular')) {
        return { titulo: 'Já existe conta com este celular', msg: 'Tente entrar com sua senha atual ou recuperar a senha.', severidade: 'warn', acao: { rotulo: 'Ir para login', href: '01-login.html' } };
      }
      if (lower.includes('perfil medico ja existe') || lower.includes('perfil médico já existe')) {
        return { titulo: 'Perfil já cadastrado', msg: 'Seu perfil profissional já existe. Vamos apenas atualizar com os novos dados.', severidade: 'info' };
      }
      if (lower.includes('credenciais') || lower.includes('senha incorreta')) {
        return { titulo: 'E-mail ou senha incorretos', msg: 'Confira suas credenciais e tente novamente.', severidade: 'error' };
      }
      if (lower.includes('codigo invalido') || lower.includes('código inválido')) {
        return { titulo: 'Código inválido', msg: 'Verifique o código recebido e tente novamente.', severidade: 'error' };
      }
      if (lower.includes('expirad')) {
        return { titulo: 'Link ou código expirou', msg: 'Solicite um novo e tente de novo.', severidade: 'warn' };
      }
    }

    // Pega o template padrão pelo status + contexto
    const tpl = (MENSAGENS[status] && (MENSAGENS[status][ctx] || MENSAGENS[status].default))
             || (MENSAGENS.default && MENSAGENS.default[ctx])
             || null;

    if (tpl) {
      return Object.assign({ severidade: status >= 500 ? 'warn' : 'error' }, tpl);
    }

    // Fallback final
    if (erroBackend) {
      return { titulo: 'Não foi possível concluir', msg: erroBackend, severidade: 'error' };
    }
    return { titulo: 'Algo deu errado', msg: 'Tente novamente em alguns segundos. Se persistir, fale com o suporte.', severidade: 'error' };
  }

  // -------- Renderização do banner profissional --------
  // Estrutura criada dentro do elemento alvo:
  //   <div class="vit-err vit-err--{severidade}" role="alert">
  //     <div class="vit-err__icon">!</div>
  //     <div class="vit-err__body">
  //       <div class="vit-err__title">{titulo}</div>
  //       <div class="vit-err__msg">{msg}</div>
  //       <div class="vit-err__actions">
  //         <button class="vit-err__btn">{acao.rotulo}</button>
  //       </div>
  //     </div>
  //     <button class="vit-err__close" aria-label="Fechar">×</button>
  //   </div>

  let cssInjetado = false;
  function injetarCss(){
    if (cssInjetado) return;
    const css = `
      .vit-err{display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:12px;border:1.5px solid;background:#fff;animation:vit-err-in .22s ease;font-family:'Plus Jakarta Sans',sans-serif;position:relative;margin-bottom:14px}
      .vit-err--error{background:#FEF3F4;border-color:#FBC8CB;color:#7A1F25}
      .vit-err--warn {background:#FFF7E8;border-color:#FCDFA0;color:#7A4F0E}
      .vit-err--info {background:#EEF6FF;border-color:#BFDBFE;color:#1E3A8A}
      .vit-err__icon{flex-shrink:0;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;line-height:1}
      .vit-err--error .vit-err__icon{background:#EF4444;color:#fff}
      .vit-err--warn  .vit-err__icon{background:#F59E0B;color:#fff}
      .vit-err--info  .vit-err__icon{background:#3B82F6;color:#fff}
      .vit-err__body{flex:1;min-width:0}
      .vit-err__title{font-size:13.5px;font-weight:700;line-height:1.3;margin-bottom:2px}
      .vit-err__msg{font-size:12.5px;font-weight:500;line-height:1.5;color:#3B404A;opacity:0.92}
      .vit-err__actions{margin-top:8px;display:flex;gap:8px;flex-wrap:wrap}
      .vit-err__btn{appearance:none;border:1.5px solid currentColor;background:transparent;color:inherit;font-family:inherit;font-size:12px;font-weight:700;padding:6px 14px;border-radius:8px;cursor:pointer;transition:background .15s,color .15s}
      .vit-err--error .vit-err__btn:hover{background:#EF4444;color:#fff;border-color:#EF4444}
      .vit-err--warn  .vit-err__btn:hover{background:#F59E0B;color:#fff;border-color:#F59E0B}
      .vit-err--info  .vit-err__btn:hover{background:#3B82F6;color:#fff;border-color:#3B82F6}
      .vit-err__close{position:absolute;top:8px;right:10px;background:transparent;border:0;font-size:18px;line-height:1;color:inherit;opacity:0.45;cursor:pointer;padding:2px 6px;border-radius:6px}
      .vit-err__close:hover{opacity:1;background:rgba(0,0,0,0.05)}
      @keyframes vit-err-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
    `;
    const style = document.createElement('style');
    style.setAttribute('data-vit-err', '1');
    style.textContent = css;
    document.head.appendChild(style);
    cssInjetado = true;
  }

  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function mostrar(alvo, info){
    if (!alvo || !info) return;
    injetarCss();
    const sev = info.severidade || 'error';
    const acao = info.acao;
    const acaoHtml = acao ? `<div class="vit-err__actions"><button type="button" class="vit-err__btn" data-acao="1">${escapeHtml(acao.rotulo || 'Tentar de novo')}</button></div>` : '';
    alvo.innerHTML = `
      <div class="vit-err vit-err--${sev}" role="alert">
        <div class="vit-err__icon">${sev === 'info' ? 'i' : sev === 'warn' ? '!' : '!'}</div>
        <div class="vit-err__body">
          <div class="vit-err__title">${escapeHtml(info.titulo)}</div>
          <div class="vit-err__msg">${escapeHtml(info.msg)}</div>
          ${acaoHtml}
        </div>
        <button type="button" class="vit-err__close" aria-label="Fechar" data-fechar="1">×</button>
      </div>
    `;
    alvo.style.display = 'block';
    // wire ações
    const btn = alvo.querySelector('[data-acao]');
    if (btn && acao) {
      btn.addEventListener('click', function(){
        if (acao.limparSessao) {
          ['vitae_token','vitae_refresh_token','vitae_usuario'].forEach(k => { try { localStorage.removeItem(k); } catch(e){} });
        }
        if (typeof acao.onClick === 'function') return acao.onClick();
        if (acao.recarregar) return location.reload();
        if (acao.href) return window.location.href = acao.href;
      });
    }
    const x = alvo.querySelector('[data-fechar]');
    if (x) x.addEventListener('click', function(){ limpar(alvo); });
    // scroll para garantir visibilidade
    try { alvo.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch(e){}
  }

  function limpar(alvo){
    if (!alvo) return;
    alvo.innerHTML = '';
    alvo.style.display = 'none';
  }

  global.vitaeAuthError = { traduzir, mostrar, limpar, CAMPOS_AMIGAVEIS };
})(typeof window !== 'undefined' ? window : globalThis);
