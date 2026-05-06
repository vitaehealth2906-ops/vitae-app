/**
 * VITAE Desktop — Form Helpers
 * Biblioteca compartilhada de máscaras, validações e UX patterns para
 * 01-login.html, 02-cadastro.html, 03-quiz-medico.html
 *
 * Uso: <script src="form-helpers.js"></script> antes do script da pagina.
 * Tudo exposto em window.vitaeForm.*
 */
(function(global){
  'use strict';

  // =====================================================================
  // MÁSCARAS DE INPUT
  // =====================================================================

  /** Celular BR (11) 99999-9999 ou fixo (11) 3333-4444 */
  function maskCelular(el){
    var v = (el.value || '').replace(/\D/g, '');
    // Remove 55 inicial caso usuário cole +5511...
    if (v.length > 11 && v.startsWith('55')) v = v.slice(2);
    v = v.slice(0, 11);
    if (v.length > 10)      v = '(' + v.slice(0,2) + ') ' + v.slice(2,7) + '-' + v.slice(7);
    else if (v.length > 6)  v = '(' + v.slice(0,2) + ') ' + v.slice(2,6) + '-' + v.slice(6);
    else if (v.length > 2)  v = '(' + v.slice(0,2) + ') ' + v.slice(2);
    el.value = v;
  }

  /** CPF 000.000.000-00 */
  function maskCPF(el){
    var v = (el.value || '').replace(/\D/g, '').slice(0, 11);
    if (v.length > 9)      v = v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6,9)+'-'+v.slice(9);
    else if (v.length > 6) v = v.slice(0,3)+'.'+v.slice(3,6)+'.'+v.slice(6);
    else if (v.length > 3) v = v.slice(0,3)+'.'+v.slice(3);
    el.value = v;
  }

  /** CEP 00000-000 */
  function maskCEP(el){
    var v = (el.value || '').replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) v = v.slice(0,5)+'-'+v.slice(5);
    el.value = v;
  }

  /** Data DD/MM/AAAA */
  function maskData(el){
    var v = (el.value || '').replace(/\D/g, '').slice(0, 8);
    if (v.length > 4)      v = v.slice(0,2)+'/'+v.slice(2,4)+'/'+v.slice(4);
    else if (v.length > 2) v = v.slice(0,2)+'/'+v.slice(2);
    el.value = v;
  }

  /** Hora HH:MM */
  function maskHora(el){
    var v = (el.value || '').replace(/\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0,2)+':'+v.slice(2);
    el.value = v;
  }

  /** R$ 1.234.567 (sem centavos) */
  function maskValor(el){
    var v = (el.value || '').replace(/\D/g, '');
    if (!v) { el.value = ''; return; }
    el.value = 'R$ ' + parseInt(v, 10).toLocaleString('pt-BR');
  }

  /** CRM — apenas dígitos, máximo 20 */
  function maskCRM(el){
    el.value = (el.value || '').replace(/\D/g, '').slice(0, 20);
  }

  /** Inteiro (qualquer campo numérico simples) */
  function maskInteiro(el){
    el.value = (el.value || '').replace(/\D/g, '');
  }

  // =====================================================================
  // VALIDAÇÕES
  // =====================================================================

  function isEmailValido(s){
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s||'').trim().toLowerCase());
  }

  function isCelularValido(s){
    var d = String(s||'').replace(/\D/g, '');
    if (d.startsWith('55') && d.length === 13) d = d.slice(2);
    return d.length >= 10 && d.length <= 11;
  }

  function isSenhaForte(s){
    s = String(s||'');
    if (s.length < 8) return { ok: false, nivel: 0, msg: 'Senha curta — mínimo 8 caracteres' };
    var pontos = 0;
    if (/[a-z]/.test(s)) pontos++;
    if (/[A-Z]/.test(s)) pontos++;
    if (/\d/.test(s))    pontos++;
    if (/[^a-zA-Z0-9]/.test(s)) pontos++;
    if (s.length >= 12)  pontos++;
    var nivel = pontos <= 2 ? 1 : (pontos === 3 ? 2 : 3);
    var label = ['—', 'Fraca', 'Média', 'Forte'][nivel];
    return { ok: nivel >= 2, nivel: nivel, msg: label };
  }

  /** Valida CPF com dígitos verificadores (algoritmo padrão) */
  function isCPFValido(cpf){
    cpf = String(cpf||'').replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(cpf)) return false; // todos iguais
    function calc(base, peso){
      var soma = 0;
      for (var i = 0; i < base.length; i++) soma += parseInt(base[i],10) * (peso - i);
      var r = (soma * 10) % 11;
      return r === 10 ? 0 : r;
    }
    var d1 = calc(cpf.slice(0,9), 10);
    var d2 = calc(cpf.slice(0,10), 11);
    return d1 === parseInt(cpf[9],10) && d2 === parseInt(cpf[10],10);
  }

  function isCEPValido(s){
    return /^\d{8}$/.test(String(s||'').replace(/\D/g, ''));
  }

  function isCRMValido(s){
    var d = String(s||'').replace(/\D/g, '');
    return d.length >= 4 && d.length <= 20;
  }

  function isDataValida(s){
    // DD/MM/AAAA
    var m = String(s||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return false;
    var d = +m[1], mes = +m[2], a = +m[3];
    if (mes < 1 || mes > 12) return false;
    if (d < 1 || d > 31) return false;
    if (a < 1900 || a > 2100) return false;
    var date = new Date(a, mes-1, d);
    return date.getFullYear()===a && date.getMonth()===mes-1 && date.getDate()===d;
  }

  function calcIdade(dataDDMMAAAA){
    var m = String(dataDDMMAAAA||'').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    var d = new Date(+m[3], +m[2]-1, +m[1]);
    var h = new Date();
    var a = h.getFullYear() - d.getFullYear();
    var diffMes = h.getMonth() - d.getMonth();
    if (diffMes < 0 || (diffMes === 0 && h.getDate() < d.getDate())) a--;
    return a;
  }

  // =====================================================================
  // VIACEP — auto-preenche endereço a partir do CEP
  // =====================================================================

  /**
   * Busca CEP via ViaCEP. Retorna { logradouro, bairro, localidade, uf } ou null.
   * Uso: const dados = await vitaeForm.buscarCEP('01310-100');
   */
  async function buscarCEP(cep){
    var c = String(cep||'').replace(/\D/g, '');
    if (c.length !== 8) return null;
    try {
      var res = await fetch('https://viacep.com.br/ws/'+c+'/json/');
      if (!res.ok) return null;
      var d = await res.json();
      if (d.erro) return null;
      return {
        logradouro: d.logradouro || '',
        bairro: d.bairro || '',
        localidade: d.localidade || '',
        uf: d.uf || '',
        completo: [d.logradouro, d.bairro, d.localidade, d.uf].filter(Boolean).join(', ')
      };
    } catch(e){ return null; }
  }

  // =====================================================================
  // UX HELPERS
  // =====================================================================

  /** Toggle de visibilidade de senha. Cria botão olho. */
  function attachPasswordToggle(inputEl){
    if (!inputEl || inputEl.dataset.pwToggle === '1') return;
    inputEl.dataset.pwToggle = '1';
    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;display:block;width:100%';
    inputEl.parentNode.insertBefore(wrap, inputEl);
    wrap.appendChild(inputEl);
    inputEl.style.paddingRight = '46px';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Mostrar ou ocultar senha');
    btn.style.cssText = 'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:transparent;border:0;cursor:pointer;padding:6px;border-radius:6px;color:#6B7280;display:flex;align-items:center;justify-content:center';
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    btn.addEventListener('mouseenter', function(){ btn.style.color = '#0D0F14'; btn.style.background = '#F2F4F7'; });
    btn.addEventListener('mouseleave', function(){ btn.style.color = '#6B7280'; btn.style.background = 'transparent'; });
    btn.addEventListener('click', function(){
      var mostrando = inputEl.type === 'text';
      inputEl.type = mostrando ? 'password' : 'text';
      btn.setAttribute('aria-label', mostrando ? 'Mostrar senha' : 'Ocultar senha');
      // Ícone com risco quando senha visível
      btn.innerHTML = mostrando
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 0 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></svg>';
    });
    wrap.appendChild(btn);
  }

  /** Detecta Caps Lock — chama callback(true|false) */
  function attachCapsLockDetector(inputEl, onChange){
    if (!inputEl) return;
    inputEl.addEventListener('keyup', function(e){
      var on = (e.getModifierState && e.getModifierState('CapsLock')) || false;
      onChange(on);
    });
    inputEl.addEventListener('keydown', function(e){
      var on = (e.getModifierState && e.getModifierState('CapsLock')) || false;
      onChange(on);
    });
  }

  /** Trim e lowercase em e-mail ao perder foco */
  function attachEmailNormalizer(inputEl){
    if (!inputEl) return;
    inputEl.addEventListener('blur', function(){
      inputEl.value = String(inputEl.value||'').trim().toLowerCase();
    });
    // Paste: extrai e-mail de texto colado (ex: "Email: foo@bar.com")
    inputEl.addEventListener('paste', function(ev){
      var clip = (ev.clipboardData || window.clipboardData);
      if (!clip) return;
      var txt = clip.getData('text');
      var m = txt && txt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (m) {
        ev.preventDefault();
        inputEl.value = m[0].toLowerCase();
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  /** Capitalize Cada Palavra ao perder foco (nome completo) */
  function attachNomeCapitalizer(inputEl){
    if (!inputEl) return;
    inputEl.addEventListener('blur', function(){
      var v = String(inputEl.value||'').trim().replace(/\s+/g, ' ');
      // Capitaliza primeira letra de cada palavra (exceto preposições curtas)
      var pequenas = ['de','da','do','das','dos','e'];
      v = v.toLowerCase().split(' ').map(function(w, i){
        if (i > 0 && pequenas.indexOf(w) >= 0) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      }).join(' ');
      inputEl.value = v;
    });
  }

  /** Paste handler: extrai apenas dígitos de texto colado (CPF, telefone, CEP) */
  function attachPasteOnlyDigits(inputEl, maskFn){
    if (!inputEl) return;
    inputEl.addEventListener('paste', function(ev){
      var clip = (ev.clipboardData || window.clipboardData);
      if (!clip) return;
      var txt = clip.getData('text') || '';
      var digits = txt.replace(/\D/g, '');
      if (!digits) return;
      ev.preventDefault();
      inputEl.value = digits;
      if (typeof maskFn === 'function') maskFn(inputEl);
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  /** Pressionar Enter num input foca o próximo (ou submete) */
  function attachEnterChain(inputs, onSubmit){
    if (!inputs || !inputs.length) return;
    inputs.forEach(function(el, i){
      if (!el) return;
      el.addEventListener('keydown', function(e){
        if (e.key !== 'Enter' || e.shiftKey) return;
        if (el.tagName === 'TEXTAREA') return;
        e.preventDefault();
        var prox = inputs[i+1];
        if (prox && typeof prox.focus === 'function') prox.focus();
        else if (typeof onSubmit === 'function') onSubmit();
      });
    });
  }

  /** Bloqueia botão durante submit, mostra texto de loading */
  function withLoading(btn, textoCarregando, fn){
    if (!btn) return fn();
    var original = btn.textContent;
    btn.disabled = true;
    btn.dataset.original = original;
    btn.textContent = textoCarregando || 'Carregando…';
    return Promise.resolve()
      .then(function(){ return fn(); })
      .finally(function(){
        btn.disabled = false;
        btn.textContent = btn.dataset.original || original;
      });
  }

  /** Indicador visual de força de senha. Cria barra abaixo do input. */
  function attachForcaSenha(inputEl){
    if (!inputEl || inputEl.dataset.forcaSenha === '1') return;
    inputEl.dataset.forcaSenha = '1';
    var bar = document.createElement('div');
    bar.style.cssText = 'margin-top:8px;height:4px;border-radius:4px;background:#E2E5EA;overflow:hidden;position:relative';
    var fill = document.createElement('div');
    fill.style.cssText = 'height:100%;width:0;transition:width .25s,background .25s';
    bar.appendChild(fill);
    var label = document.createElement('div');
    label.style.cssText = 'font-size:11px;font-weight:600;color:#9CA3AF;margin-top:5px;letter-spacing:0.02em';
    label.textContent = '';
    var parent = inputEl.parentNode.parentNode || inputEl.parentNode;
    parent.appendChild(bar);
    parent.appendChild(label);
    inputEl.addEventListener('input', function(){
      var r = isSenhaForte(inputEl.value);
      var pct = r.nivel === 0 ? 0 : (r.nivel === 1 ? 33 : (r.nivel === 2 ? 66 : 100));
      var cor = r.nivel === 1 ? '#EF4444' : (r.nivel === 2 ? '#F59E0B' : '#00C47A');
      fill.style.width = pct + '%';
      fill.style.background = cor;
      label.textContent = inputEl.value ? 'Força: ' + r.msg : '';
      label.style.color = inputEl.value ? cor : '#9CA3AF';
    });
  }

  /** Mostra warning "Caps Lock ativado" abaixo do input */
  function attachCapsLockWarning(inputEl){
    if (!inputEl) return;
    var warn = document.createElement('div');
    warn.style.cssText = 'font-size:11.5px;color:#F59E0B;margin-top:6px;display:none;font-weight:600';
    warn.innerHTML = '⚠ Caps Lock está ativado';
    inputEl.parentNode.appendChild(warn);
    attachCapsLockDetector(inputEl, function(on){
      warn.style.display = on ? 'block' : 'none';
    });
  }

  // =====================================================================
  // SETUP em massa — chama attachAll(form-id) e configura tudo
  // =====================================================================

  /**
   * Aplica máscaras e UX automaticamente em inputs com data-attributes:
   *   <input data-mask="celular|cpf|cep|data|hora|valor|crm|inteiro">
   *   <input data-pw-toggle="1" type="password">
   *   <input data-pw-strength="1">
   *   <input data-caps-warn="1">
   *   <input data-email-normalize="1">
   *   <input data-nome-capitalize="1">
   *   <input data-paste-digits="1">
   */
  function autoSetup(rootEl){
    rootEl = rootEl || document;
    var maskFns = { celular: maskCelular, cpf: maskCPF, cep: maskCEP, data: maskData, hora: maskHora, valor: maskValor, crm: maskCRM, inteiro: maskInteiro };
    rootEl.querySelectorAll('[data-mask]').forEach(function(el){
      var name = el.dataset.mask;
      var fn = maskFns[name];
      if (!fn) return;
      el.addEventListener('input', function(){ fn(el); });
      if (el.dataset.pasteDigits === '1') attachPasteOnlyDigits(el, fn);
    });
    rootEl.querySelectorAll('[data-pw-toggle="1"]').forEach(attachPasswordToggle);
    rootEl.querySelectorAll('[data-pw-strength="1"]').forEach(attachForcaSenha);
    rootEl.querySelectorAll('[data-caps-warn="1"]').forEach(attachCapsLockWarning);
    rootEl.querySelectorAll('[data-email-normalize="1"]').forEach(attachEmailNormalizer);
    rootEl.querySelectorAll('[data-nome-capitalize="1"]').forEach(attachNomeCapitalizer);
  }

  // Auto-aplica ao DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ autoSetup(document); });
  } else {
    setTimeout(function(){ autoSetup(document); }, 0);
  }

  // =====================================================================
  // EXPORT
  // =====================================================================
  global.vitaeForm = {
    // Máscaras
    maskCelular: maskCelular,
    maskCPF: maskCPF,
    maskCEP: maskCEP,
    maskData: maskData,
    maskHora: maskHora,
    maskValor: maskValor,
    maskCRM: maskCRM,
    maskInteiro: maskInteiro,
    // Validações
    isEmailValido: isEmailValido,
    isCelularValido: isCelularValido,
    isSenhaForte: isSenhaForte,
    isCPFValido: isCPFValido,
    isCEPValido: isCEPValido,
    isCRMValido: isCRMValido,
    isDataValida: isDataValida,
    calcIdade: calcIdade,
    // ViaCEP
    buscarCEP: buscarCEP,
    // UX
    attachPasswordToggle: attachPasswordToggle,
    attachCapsLockDetector: attachCapsLockDetector,
    attachCapsLockWarning: attachCapsLockWarning,
    attachEmailNormalizer: attachEmailNormalizer,
    attachNomeCapitalizer: attachNomeCapitalizer,
    attachPasteOnlyDigits: attachPasteOnlyDigits,
    attachEnterChain: attachEnterChain,
    attachForcaSenha: attachForcaSenha,
    withLoading: withLoading,
    autoSetup: autoSetup,
  };
})(typeof window !== 'undefined' ? window : globalThis);
