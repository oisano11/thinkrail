import {
	RiAlertLine,
	RiCheckboxCircleLine,
	RiErrorWarningLine,
	RiInformationLine,
} from "@remixicon/react";
import { Button } from "@thinkrail/ui/button";
import {
	Toast,
	ToastAction,
	ToastClose,
	ToastDescription,
	ToastProvider,
	ToastTitle,
	ToastViewport,
} from "@thinkrail/ui/toast";
import { cn } from "@thinkrail/ui/utils";
import { t } from "@/i18n";
import type { Toast as ToastType } from "@/store";
import { useAppStore } from "@/store";

const variantIcon: Record<ToastType["variant"], { Icon: typeof RiAlertLine; className: string }> = {
	error: { Icon: RiErrorWarningLine, className: "text-feedback-error" },
	success: { Icon: RiCheckboxCircleLine, className: "text-feedback-success" },
	warning: { Icon: RiAlertLine, className: "text-feedback-warning" },
	info: { Icon: RiInformationLine, className: "text-feedback-info" },
};

const AUTO_DISMISS_MS = 5000;

export function Toaster() {
	const toasts = useAppStore((s) => s.toasts);
	const dismissToast = useAppStore((s) => s.dismissToast);
	return (
		<ToastProvider swipeDirection="right">
			{toasts.map((toast) => {
				const { Icon, className: iconClass } = variantIcon[toast.variant];
				return (
					<Toast
						key={toast.id}
						variant={toast.variant}
						duration={
							toast.durationMs ??
							(toast.variant === "error" ? Number.POSITIVE_INFINITY : AUTO_DISMISS_MS)
						}
						onOpenChange={(open) => {
							if (!open) dismissToast(toast.id);
						}}
						data-testid="toast"
						data-variant={toast.variant}
					>
						<div className="flex items-start gap-8">
							<Icon className={cn("mt-2 size-14 shrink-0", iconClass)} aria-hidden />
							<div className="flex min-w-0 flex-1 flex-col gap-4">
								{toast.title ? <ToastTitle>{toast.title}</ToastTitle> : null}
								<ToastDescription className={toast.title ? undefined : "text-text-default"}>
									{toast.message}
								</ToastDescription>
							</div>
							<ToastClose aria-label={t("Dismiss")} />
						</div>
						{toast.action ? (
							<div className="mt-12 flex justify-end">
								<ToastAction altText={toast.action.label} asChild>
									<Button
										variant="outline"
										size="sm"
										data-testid="toast-action"
										onClick={toast.action.onClick}
									>
										{toast.action.label}
									</Button>
								</ToastAction>
							</div>
						) : null}
					</Toast>
				);
			})}
			{/* The viewport is the live region screen readers announce toasts from; its default
			    name comes from Radix in English, so it is named here where the catalog lives. */}
			<ToastViewport label={t("Notifications ({0})", "F8")} />
		</ToastProvider>
	);
}
