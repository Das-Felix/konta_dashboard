<script>
	/**
	 * Button wie in der Konta-App (`src/lib/components/ui/Button.svelte`):
	 * gleiche Varianten und Größen, Icons hier als Lucide-Komponente.
	 *
	 * @typedef {'primary' | 'secondary' | 'ghost' | 'inverse'} ButtonVariant
	 * @typedef {'lg' | 'md' | 'sm'} ButtonSize
	 */

	/**
	 * @type {{
	 *   variant?: ButtonVariant,
	 *   size?: ButtonSize,
	 *   icon?: import('svelte').Component<any>,
	 *   disabled?: boolean,
	 *   type?: 'button' | 'submit' | 'reset',
	 *   href?: string,
	 *   class?: string,
	 *   children?: import('svelte').Snippet,
	 *   [key: string]: any
	 * }}
	 */
	let {
		variant = 'primary',
		size = 'md',
		icon: IconComponent,
		disabled = false,
		type = 'button',
		href,
		class: className = '',
		children,
		...rest
	} = $props();

	const base =
		'group inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap font-semibold leading-none transition-[background,border-color,color] duration-150 ease-out focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-45';

	const sizeClass = $derived(
		{
			sm: 'h-control-sm rounded-md px-3.5 text-sm',
			md: 'h-control rounded-md px-5 text-base',
			lg: 'h-control-lg rounded-xl px-7 text-[17px]'
		}[size]
	);

	const variantClass = $derived(
		{
			primary:
				'border-none bg-green text-ink not-disabled:hover:bg-green-600 not-disabled:active:bg-green-700',
			secondary:
				'border-[1.5px] border-ink bg-transparent text-ink not-disabled:hover:bg-violet-50 not-disabled:active:bg-violet-100',
			ghost:
				'border-none bg-transparent text-ink not-disabled:hover:bg-violet-50 not-disabled:active:bg-violet-100',
			inverse:
				'border-none bg-ink text-paper not-disabled:hover:text-green not-disabled:active:bg-ink-700'
		}[variant]
	);

	const iconSize = $derived(size === 'sm' ? 16 : 18);
</script>

{#if href && !disabled}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- Aufrufer übergibt einen fertigen Pfad -->
	<a {href} class="{base} {sizeClass} {variantClass} {className}" {...rest}>
		{#if IconComponent}<IconComponent size={iconSize} strokeWidth={1.75} />{/if}
		{#if children}{@render children()}{/if}
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{:else}
	<button {type} {disabled} class="{base} {sizeClass} {variantClass} {className}" {...rest}>
		{#if IconComponent}<IconComponent size={iconSize} strokeWidth={1.75} />{/if}
		{#if children}{@render children()}{/if}
	</button>
{/if}
