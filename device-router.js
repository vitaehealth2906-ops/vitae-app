// device-router.js — Detecta se o dispositivo é mobile ou desktop
// Usado por todas as telas do médico pra redirecionar pra versão certa

(function() {
  'use strict';

  var isTouch = navigator.maxTouchPoints > 1;
  var isNarrow = window.screen.width < 1024;
  var isMobile = isTouch || isNarrow;

  window.vitaeDevice = {
    isMobile: isMobile,
    isDesktop: !isMobile
  };

  // Guarda onde redirecionar médico desktop após login
  var desktopRoutes = {
    'dashboard': '/desktop/dashboard.html',
    'pre-consulta': '/desktop/pre-consulta.html',
    'oms': '/desktop/oms.html',
    'pre-consultas': '/desktop/pre-consultas.html',
    'pacientes': '/desktop/pacientes.html',
    'crm': '/desktop/crm.html',
    'templates': '/desktop/templates.html',
    'perfil': '/desktop/perfil.html',
    'login': '/desktop/login.html'
  };

  var mobileRoutes = {
    'dashboard': '/20-medico-dashboard.html',
    'login': '/03-cadastro.html'
  };

  window.vitaeDevice.getMedicoRoute = function(page) {
    if (isMobile) {
      return mobileRoutes[page] || '/20-medico-dashboard.html';
    }
    return desktopRoutes[page] || '/desktop/dashboard.html';
  };

  // Guard: redireciona se está na versão errada
  // Chamar nas páginas desktop pra forçar mobile se necessário (e vice-versa)
  window.vitaeDevice.guardDesktop = function() {
    if (isMobile) {
      window.location.href = '/20-medico-dashboard.html';
    }
  };

  window.vitaeDevice.guardMobile = function() {
    if (!isMobile) {
      var usuario = null;
      try { usuario = JSON.parse(localStorage.getItem('vitae_usuario')); } catch(e) {}
      if (usuario && usuario.tipo === 'MEDICO') {
        window.location.href = '/desktop/dashboard.html';
      }
    }
  };
})();
