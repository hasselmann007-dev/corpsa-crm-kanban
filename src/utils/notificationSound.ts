/**
 * Utilitário de Notificações do Navegador e Alerta Sonoro CORPSA
 */

let sharedAudioCtx: AudioContext | null = null;

/**
 * Obtém e desbloqueia o AudioContext no navegador
 */
function getUnlockedAudioContext(): AudioContext | null {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    
    if (!sharedAudioCtx) {
      sharedAudioCtx = new AudioContextClass();
    }
    
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    
    return sharedAudioCtx;
  } catch (e) {
    return null;
  }
}

// Desbloqueia o AudioContext na primeira interação do usuário (clique, tecla ou toque)
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getUnlockedAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };

  window.addEventListener('click', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });
  window.addEventListener('touchstart', unlockAudio, { passive: true });
}

/**
 * Toca um alerta sonoro harmônico de 3 tons (E5 -> A5 -> E6)
 */
export function playAlertChime(): void {
  try {
    const ctx = getUnlockedAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().then(() => playTones(ctx)).catch(() => {});
    } else {
      playTones(ctx);
    }
  } catch (e) {
    console.warn('Não foi possível tocar o alerta sonoro:', e);
  }
}

function playTones(ctx: AudioContext): void {
  const now = ctx.currentTime;

  // Tom 1: 659.25 Hz (E5)
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(659.25, now);
  gain1.gain.setValueAtTime(0.4, now);
  gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  osc1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.3);

  // Tom 2: 880 Hz (A5)
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(880, now + 0.12);
  gain2.gain.setValueAtTime(0.45, now + 0.12);
  gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
  osc2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(now + 0.12);
  osc2.stop(now + 0.5);

  // Tom 3: 1318.5 Hz (E6)
  const osc3 = ctx.createOscillator();
  const gain3 = ctx.createGain();
  osc3.type = 'triangle';
  osc3.frequency.setValueAtTime(1318.51, now + 0.25);
  gain3.gain.setValueAtTime(0.35, now + 0.25);
  gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
  osc3.connect(gain3);
  gain3.connect(ctx.destination);
  osc3.start(now + 0.25);
  osc3.stop(now + 0.75);
}

/**
 * Solicita permissão do navegador para exibir notificações na área de trabalho
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      playAlertChime();
      new Notification('🔔 Notificações Ativadas - CORPSA CRM', {
        body: 'Alertas sonoros e notificações de área de trabalho configurados com sucesso.',
        icon: '/favicon.ico'
      });
    }
    return permission;
  } catch (e) {
    console.warn('Erro ao solicitar permissão de notificação:', e);
    return 'denied';
  }
}

/**
 * Dispara notificação nativa com som ao chegar um novo lead na Roleta
 */
export function notifyNewLeadArrival(leadName: string, cpf?: string, mo?: string): void {
  playAlertChime();

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const details = [
        `Cliente: ${leadName}`,
        cpf ? `CPF: ${cpf}` : null,
        mo ? `MO: ${mo}` : null,
        '⚡ Nova pasta na Roleta para triagem.'
      ].filter(Boolean).join('\n');

      const n = new Notification('🚨 Nova Pasta na Roleta (CORPSA CRM)', {
        body: details,
        icon: '/favicon.ico',
        tag: `lead_${Date.now()}`
      });

      n.onclick = () => {
        window.focus();
        n.close();
      };
    } catch (e) {
      console.warn('Erro ao disparar notificação:', e);
    }
  }
}
