import confetti from 'canvas-confetti';

export class ConfettiService {
  private static readonly defaults = {
    origin: { y: 0.7 },
    spread: 90,
    ticks: 400,
    gravity: 1.2,
    decay: 0.94,
    startVelocity: 45,
    colors: ['#37bd7e', '#34D399', '#6EE7B7', '#059669', '#047857']
  };

  private static fire(particleRatio: number, opts: any) {
    confetti({
      ...this.defaults,
      ...opts,
      particleCount: Math.floor(200 * particleRatio)
    });
  }

  public static celebrate() {
    // Left side burst (50% reduced)
    this.fire(0.125, {
      spread: 26,
      startVelocity: 55,
      origin: { x: 0.2, y: 0.9 }
    });

    // Right side burst (50% reduced)
    this.fire(0.125, {
      spread: 26,
      startVelocity: 55,
      origin: { x: 0.8, y: 0.9 }
    });

    // Center burst (50% reduced)
    this.fire(0.175, {
      spread: 100,
      decay: 0.91,
      origin: { x: 0.5, y: 0.8 }
    });

    // Delayed follow-up bursts (50% reduced)
    setTimeout(() => {
      this.fire(0.05, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        origin: { x: 0.3, y: 0.8 }
      });
    }, 200);

    setTimeout(() => {
      this.fire(0.05, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        origin: { x: 0.7, y: 0.8 }
      });
    }, 200);

    // Final celebratory burst (50% reduced)
    setTimeout(() => {
      this.fire(0.1, {
        spread: 150,
        startVelocity: 45,
        decay: 0.91,
        origin: { x: 0.5, y: 0.9 }
      });
    }, 400);
  }

  /**
   * Gold confetti for VIP tier unlock
   */
  public static tierUnlock(tier: 'gold' | 'silver' | 'bronze') {
    const colors = {
      gold: ['#FFD700', '#FDB931', '#FFED4E', '#FFC107', '#FF9800'],
      silver: ['#C0C0C0', '#E8E8E8', '#D3D3D3', '#B0B0B0', '#A8A8A8'],
      bronze: ['#CD7F32', '#B87333', '#D4976C', '#C9863C', '#AF7544']
    };

    const tierColors = colors[tier];

    // Dramatic center explosion
    confetti({
      particleCount: 150,
      spread: 180,
      origin: { y: 0.6 },
      colors: tierColors,
      startVelocity: 50,
      gravity: 1,
      ticks: 600
    });

    // Side bursts
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: tierColors
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: tierColors
      });
    }, 200);
  }

  /**
   * Celebration for significant position jumps
   */
  public static positionJump(spotsJumped: number) {
    const intensity = Math.min(spotsJumped / 25, 1); // Scale up to 25 spots
    const particleCount = Math.floor(100 * intensity);

    confetti({
      particleCount,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#34D399', '#10B981', '#059669', '#047857'],
      startVelocity: 30 + (intensity * 20)
    });
  }

  /**
   * Milestone celebrations (first share, first referral, etc.)
   */
  public static milestone(type: 'first_share' | 'first_referral' | 'top_50' | 'referral_5') {
    const configs = {
      first_share: {
        particleCount: 50,
        spread: 60,
        colors: ['#3B82F6', '#60A5FA', '#93C5FD']
      },
      first_referral: {
        particleCount: 80,
        spread: 90,
        colors: ['#10B981', '#34D399', '#6EE7B7']
      },
      referral_5: {
        particleCount: 120,
        spread: 120,
        colors: ['#8B5CF6', '#A78BFA', '#C4B5FD']
      },
      top_50: {
        particleCount: 200,
        spread: 180,
        colors: ['#FFD700', '#FDB931', '#FFED4E']
      }
    };

    const config = configs[type];

    confetti({
      ...config,
      origin: { y: 0.6 },
      startVelocity: 35,
      gravity: 1.2,
      ticks: 400
    });

    // Extra burst for top_50
    if (type === 'top_50') {
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 100,
          origin: { y: 0.7 },
          colors: config.colors
        });
      }, 300);
    }
  }

  /**
   * Subtle confetti for UI interactions
   */
  public static subtle() {
    confetti({
      particleCount: 30,
      spread: 50,
      origin: { y: 0.7 },
      colors: ['#3B82F6', '#8B5CF6'],
      startVelocity: 25,
      gravity: 1.5,
      ticks: 200
    });
  }
}