'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { SubmitButton } from '@/components/ui/submit-button';
import { ConnectingScreen } from '@/components/dashboard/connecting-screen';
import { WallpaperBackground } from '@/components/ui/wallpaper-background';
import { DonnaLogo } from '@/components/sidebar/donna-logo';
import { sanitizeAuthReturnUrl } from '@/lib/auth/return-url';
import { toast } from '@/lib/toast';
import { setInitialPassword, skipInitialPassword } from '../actions';

function SetPasswordContent() {
  const searchParams = useSearchParams();
  const returnUrl = sanitizeAuthReturnUrl(searchParams.get('returnUrl'));
  const [skipping, setSkipping] = useState(false);

  // Após definir ou pular, segue pro destino com um full-load (garante que o
  // cookie de sessão atualizado seja lido).
  const goToApp = () => {
    window.location.href = returnUrl;
  };

  const handleSetPassword = async (prevState: unknown, formData: FormData) => {
    const result = await setInitialPassword(prevState, formData);
    if (result && typeof result === 'object') {
      if ('success' in result && result.success) {
        toast.success('Senha definida com sucesso');
        goToApp();
        return result;
      }
      if ('message' in result) {
        toast.error('Não foi possível definir a senha', {
          description: result.message as string,
          duration: 5000,
        });
        return {};
      }
    }
    return result;
  };

  const handleSkip = async () => {
    if (skipping) return;
    setSkipping(true);
    try {
      await skipInitialPassword();
    } finally {
      goToApp();
    }
  };

  return (
    <div className="fixed inset-0 overflow-hidden">
      <WallpaperBackground wallpaperId="brandmark" />
      <div className="absolute inset-0 bg-background/20 backdrop-blur-[2px]" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4">
        <div className="w-full max-w-[360px]">
          <div className="bg-background/80 dark:bg-background/75 backdrop-blur-2xl border border-foreground/[0.06] rounded-[20px] px-7 py-8">
            <div className="flex flex-col items-center mb-6">
              <DonnaLogo size={26} />
              <div className="mt-5 flex h-11 w-11 items-center justify-center rounded-full bg-foreground/[0.06] border border-foreground/[0.08]">
                <KeyRound className="h-5 w-5 text-foreground/50" />
              </div>
              <h1 className="mt-4 text-[18px] font-semibold text-foreground/95 tracking-tight">
                Defina sua senha
              </h1>
              <p className="mt-1.5 text-[13px] text-foreground/45 text-center leading-relaxed">
                Você entrou com a senha padrão. Crie uma senha sua para deixar a
                conta segura.
              </p>
            </div>

            <form className="space-y-3">
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Nova senha"
                required
                autoComplete="new-password"
                autoFocus
                className="h-11 text-sm rounded-xl bg-foreground/[0.03] border-foreground/[0.08] shadow-none focus-visible:border-foreground/20 transition-colors"
              />
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirme a nova senha"
                required
                autoComplete="new-password"
                className="h-11 text-sm rounded-xl bg-foreground/[0.03] border-foreground/[0.08] shadow-none focus-visible:border-foreground/20 transition-colors"
              />
              <SubmitButton
                formAction={handleSetPassword}
                className="w-full h-11 text-[13px] font-medium rounded-xl shadow-none mt-1"
                pendingText="Salvando…"
              >
                Salvar senha
              </SubmitButton>
            </form>

            <div className="flex justify-center mt-5">
              <button
                type="button"
                onClick={handleSkip}
                disabled={skipping}
                className="text-xs text-foreground/30 hover:text-foreground/50 transition-colors disabled:opacity-50"
              >
                {skipping ? 'Entrando…' : 'Pular por enquanto'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<ConnectingScreen forceConnecting minimal title="Carregando" />}>
      <SetPasswordContent />
    </Suspense>
  );
}
