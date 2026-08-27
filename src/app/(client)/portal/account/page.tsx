import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { ArrowLeft } from "lucide-react";
import { requireClient } from "@/lib/data/session";
import { PageHeader } from "@/components/shell/page-header";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { NameForm, PasswordForm } from "@/components/account/account-forms";
import { TextSizeForm } from "@/components/account/text-size-form";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale";
import { TEXT_SIZE_COOKIE, parseTextSize } from "@/lib/text-size";
import { dict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const locale = parseLocale((await cookies()).get(LOCALE_COOKIE)?.value);
  return { title: dict(locale).yourAccount };
}

/**
 * The client's account page — name, password, and how big the text is.
 *
 * The teammate version at /account also carries an identity colour, chat alert
 * settings and the roster of everyone else's colours. The last one is a roster,
 * which a client must never see (0062 §5); the other two belong to surfaces a
 * client doesn't have. Rather than gate them one by one on a shared page, the
 * portal gets its own — the same reason the two shells are separate route
 * groups at all.
 *
 * The text size is the one that came ACROSS, and it should have been here from
 * the start: every font size in the app is a fraction of `--text-scale`, and a
 * client had no control over it while every teammate did. The person most
 * likely to need larger text is the one filling in a nine-section form on a
 * tablet, not the developer with two monitors.
 *
 * The three forms are the teammate components, shared: `updateName` and
 * `updatePassword` act on the caller's OWN row and pass through no section
 * gate, and the text size is a cookie write with no server involved — so all
 * three are correct for either principal without a special case.
 *
 * All three are `"use client"`, so they cannot read the dictionary themselves.
 * Each takes a `labels` bundle of strings already resolved here, on the server,
 * against the cookie's locale — the same shape the sidebar's `PortalNavLabels`
 * uses. The prop is optional and defaults to today's English, which is what
 * keeps the teammate /account page rendering byte-identical with no edit.
 */
export default async function PortalAccountPage() {
  const ctx = await requireClient();
  const jar = await cookies();
  const locale = parseLocale(jar.get(LOCALE_COOKIE)?.value);
  const textSize = parseTextSize(jar.get(TEXT_SIZE_COOKIE)?.value);
  const t = dict(locale);

  return (
    <>
      <Link
        href="/portal"
        className="mb-4 inline-flex items-center gap-1.5 text-[calc(14px*var(--text-scale,1))] text-muted hover:text-ink"
      >
        <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
        {t.accountBack}
      </Link>
      <PageHeader title={t.yourAccount} description={ctx.profile.email} />
      <div className="grid max-w-2xl gap-6">
        <Panel>
          <PanelHeader title={t.accountName} />
          <NameForm
            currentName={ctx.profile.full_name}
            labels={{
              fullName: t.accountFullName,
              placeholder: t.accountName,
              save: t.accountSaveName,
            }}
          />
        </Panel>
        <Panel>
          <PanelHeader title={t.accountPassword} />
          <PasswordForm
            labels={{
              newPassword: t.accountNewPassword,
              repeat: t.accountRepeatPassword,
              submit: t.accountChangePassword,
            }}
          />
        </Panel>
        <Panel>
          <PanelHeader title={t.textSize} />
          <TextSizeForm
            current={textSize}
            labels={{
              group: t.textSize,
              note: t.textSizeNote,
              sizes: {
                sm: t.textSizeSmall,
                md: t.textSizeDefault,
                lg: t.textSizeLarge,
                xl: t.textSizeLargest,
              },
            }}
          />
        </Panel>
      </div>
    </>
  );
}
