import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Native Capacitor Mobile Bridge for Android & iOS
 * - Configures StatusBar and hides SplashScreen when running natively
 * - Provides hardware back-button handling on Android (deselects active block or triggers undo)
 * - Triggers native tactile Haptics for crane drops, block selection, rotation, and level completion
 */
class NativeMobileBridge {
  private initialized = false;

  public isNative(): boolean {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  }

  public getPlatform(): string {
    try {
      return Capacitor.getPlatform();
    } catch {
      return 'web';
    }
  }

  public async initNativeShell(onBackAction?: () => boolean): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    if (!this.isNative()) return;

    try {
      await StatusBar.setStyle({ style: Style.Dark });
      if (this.getPlatform() === 'android') {
        await StatusBar.setBackgroundColor({ color: '#090d16' });
      }
    } catch {
      // Ignore if status bar plugin is unavailable
    }

    try {
      await SplashScreen.hide({ fadeOutDuration: 300 });
    } catch {
      // Ignore if splash screen plugin is unavailable
    }

    try {
      CapApp.addListener('backButton', ({ canGoBack }) => {
        if (onBackAction && onBackAction()) {
          return;
        }
        if (!canGoBack) {
          CapApp.minimizeApp().catch(() => {});
        }
      });
    } catch {
      // Ignore on web/iOS
    }
  }

  public async impactLight(): Promise<void> {
    if (!this.isNative()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Ignore haptic errors
    }
  }

  public async impactMedium(): Promise<void> {
    if (!this.isNative()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // Ignore haptic errors
    }
  }

  public async impactHeavy(): Promise<void> {
    if (!this.isNative()) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Ignore haptic errors
    }
  }

  public async notifySuccess(): Promise<void> {
    if (!this.isNative()) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // Ignore haptic errors
    }
  }
}

export const mobileBridge = new NativeMobileBridge();
