import { LockClosedIcon } from "@heroicons/react/16/solid";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useRef, useState, type FormEvent } from "react";
import { authErrorMessage, isCredentialError } from "../../lib/auth/authErrors";
import { useAuth } from "../../lib/auth/useAuth";
import { cx } from "../../lib/cx";
import { BrandTile } from "../layout/BrandMark";
import { Button } from "../ui/Button";
import { IconButton } from "../ui/IconButton";
import { InlineAlert } from "../ui/InlineAlert";
import { TextField } from "../ui/TextField";

/**
 * «Anmelden» (derived private login, Phase 1 §1.1): the designed login without the reset
 * and registration links, plus the private-access hint. Doesn't navigate itself: the auth
 * state change moves the app on.
 */
export function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const credentialError = error !== null && isCredentialError(error);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // No native validation bubbles (they'd be in the browser's language): focus the gap instead.
    if (!email.trim()) return emailRef.current?.focus();
    if (!password) return passwordRef.current?.focus();

    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError);
      setSubmitting(false);
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-1 flex-col gap-7 lg:gap-6">
      <div className="flex flex-col gap-3.5 lg:gap-2">
        <BrandTile size={48} className="lg:hidden" />
        <span className="mb-4 hidden items-center gap-2.5 lg:flex">
          <BrandTile size={36} />
          <span className="font-display text-[22px] font-medium">Household</span>
        </span>
        <h1 className="font-display text-display text-ink lg:text-[40px] lg:leading-[46px]">
          Willkommen zurück
        </h1>
        <p className={cx("text-body text-ink-muted lg:hidden", error !== null && "hidden")}>
          Melde dich an und schau, was bei euch zu Hause ansteht.
        </p>
        <p className="hidden text-body text-ink-muted lg:block">
          Melde dich an, um weiterzumachen.
        </p>
      </div>

      {error !== null && (
        <InlineAlert tone="danger" className="text-[15px] leading-[21px] lg:items-center">
          <strong className="font-semibold">{authErrorMessage(error)}</strong>
          {credentialError && (
            <span className="lg:hidden"> Prüfe deine Angaben und versuch es nochmals.</span>
          )}
        </InlineAlert>
      )}

      <div className="flex flex-col gap-4">
        <TextField
          ref={emailRef}
          label="E-Mail"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={submitting}
          invalid={credentialError}
        />
        <TextField
          ref={passwordRef}
          label="Passwort"
          type={showPassword ? "text" : "password"}
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={submitting}
          invalid={credentialError}
          inputClassName={cx(!showPassword && password && "text-[18px] tracking-[0.15em]")}
          trailing={
            <IconButton
              aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
              icon={showPassword ? EyeSlashIcon : EyeIcon}
              onClick={() => setShowPassword((shown) => !shown)}
              disabled={submitting}
            />
          }
        />
      </div>

      <div className="mt-auto flex flex-col gap-3 lg:mt-0">
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          loadingLabel="Meldet an…"
          className="lg:h-12 lg:text-body"
        >
          Anmelden
        </Button>
        <p className="flex min-h-11 items-center justify-center text-center text-caption text-balance text-ink-subtle">
          <span>
            <LockClosedIcon aria-hidden="true" className="mr-1.5 inline size-4 align-[-3px]" />
            Household ist privat. Zugang nur für eingeladene Personen.
          </span>
        </p>
      </div>
    </form>
  );
}
