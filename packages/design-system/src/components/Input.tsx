import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../lib/utils';

export type InputType = 'text' | 'email' | 'phone' | 'password' | 'number' | 'search' | 'url' | 'currency';

export interface CurrencyFormatOptions {
  /** ISO-4217 currency code, e.g. "KES". Defaults to "KES". */
  currency?: string;
  /** BCP-47 locale tag, e.g. "en-KE". Defaults to "en-KE". */
  locale?: string;
  /** Maximum fraction digits shown (defaults to 2). */
  maximumFractionDigits?: number;
  /** Minimum fraction digits shown (defaults to 0 so integer entries stay clean). */
  minimumFractionDigits?: number;
  /** When true, the currency symbol is not shown inside the input value. */
  hideSymbol?: boolean;
}

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'prefix'> {
  /** Input variant: text, email, phone, password, number, search, url, currency */
  inputType?: InputType;
  /** Native HTML input type - overrides inputType when set */
  type?: React.InputHTMLAttributes<HTMLInputElement>['type'];
  /** Show error state styling */
  error?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Hint/helper text shown when the field is not in the error state. */
  hint?: string;
  /** @deprecated use `hint` */
  helperText?: string;
  /**
   * Inline slot rendered before the input text (e.g. a currency symbol, a
   * fixed prefix like "+254"). Renders inside a non-interactive container.
   */
  prefix?: React.ReactNode;
  /**
   * Inline slot rendered after the input text (e.g. a unit suffix like "kg").
   */
  suffix?: React.ReactNode;
  /** Icon on the left side of input */
  leftIcon?: React.ReactNode;
  /** Icon on the right side of input */
  rightIcon?: React.ReactNode;
  /** Label for the input */
  label?: string;
  /** Required field indicator */
  required?: boolean;
  /** Input size variant */
  inputSize?: 'sm' | 'default' | 'lg';
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /**
   * Currency formatting options. When `inputType === 'currency'` and a
   * controlled value is provided, the displayed value is formatted with
   * Intl.NumberFormat on blur; user input is parsed back to a plain numeric
   * string on change before being forwarded to `onChange`.
   */
  currency?: CurrencyFormatOptions;
}

const inputTypeConfig: Record<
  InputType,
  {
    type: React.HTMLInputTypeAttribute;
    autoComplete?: string;
    inputMode?: 'decimal' | 'numeric' | 'none' | 'search' | 'text' | 'tel' | 'url' | 'email';
  }
> = {
  text: { type: 'text', autoComplete: 'off' },
  email: { type: 'email', autoComplete: 'email', inputMode: 'email' },
  phone: { type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
  password: { type: 'password', autoComplete: 'current-password' },
  number: { type: 'number', inputMode: 'numeric' },
  search: { type: 'search', autoComplete: 'off' },
  url: { type: 'url', autoComplete: 'url', inputMode: 'url' },
  currency: { type: 'text', inputMode: 'decimal' },
};

/**
 * Strip grouping separators / currency symbols from user input so the raw
 * numeric string can be stored in application state. Returns the string
 * unchanged when it does not look like a number (lets validators flag it).
 */
export function parseCurrencyInput(raw: string): string {
  if (!raw) return '';
  // Keep digits, a leading minus, and at most one decimal separator.
  const cleaned = raw.replace(/[^0-9.,-]/g, '');
  // Normalize commas: treat the last "." or "," as the decimal separator,
  // strip the others.
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  const decimalIdx = Math.max(lastDot, lastComma);
  if (decimalIdx === -1) return cleaned.replace(/,/g, '');
  const integerPart = cleaned.slice(0, decimalIdx).replace(/[.,]/g, '');
  const decimalPart = cleaned.slice(decimalIdx + 1).replace(/[.,]/g, '');
  return decimalPart ? `${integerPart}.${decimalPart}` : integerPart;
}

/**
 * Format a raw numeric string using Intl.NumberFormat with the configured
 * currency. Returns the input string unchanged if it does not parse to a
 * finite number so that partial user input (e.g. "12.") survives rerenders.
 */
export function formatCurrencyValue(
  raw: string | number,
  options: CurrencyFormatOptions = {}
): string {
  const {
    currency = 'KES',
    locale = 'en-KE',
    maximumFractionDigits = 2,
    minimumFractionDigits = 0,
    hideSymbol = false,
  } = options;
  const asNumber = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(asNumber)) return String(raw);
  return new Intl.NumberFormat(locale, {
    style: hideSymbol ? 'decimal' : 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(asNumber);
}

const sizeClasses = {
  sm: 'h-8 text-xs px-2',
  default: 'h-10 text-sm px-3',
  lg: 'h-12 text-base px-4',
};

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type: typeProp,
      inputType = 'text',
      error,
      errorMessage,
      hint,
      helperText,
      prefix,
      suffix,
      leftIcon,
      rightIcon,
      label,
      required,
      inputSize = 'default',
      id,
      'aria-label': ariaLabel,
      currency,
      value,
      defaultValue,
      onChange,
      onBlur,
      onFocus,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = React.useState(false);
    const inputId = id || React.useId();
    const config = inputTypeConfig[inputType];
    const isPassword = inputType === 'password';
    const isCurrency = inputType === 'currency';
    const resolvedType = typeProp ?? (isPassword && showPassword ? 'text' : config.type);

    const inputProps = {
      ...(typeProp ? {} : { autoComplete: config.autoComplete, inputMode: config.inputMode }),
    };

    // Controlled mode is determined by `value` being provided; otherwise the
    // input manages its own value (uncontrolled / defaultValue).
    const isControlled = value !== undefined;
    const [focused, setFocused] = React.useState(false);
    const [internalUncontrolled, setInternalUncontrolled] = React.useState<string>(
      defaultValue !== undefined ? String(defaultValue) : ''
    );

    const rawValue = isControlled ? String(value ?? '') : internalUncontrolled;

    // For currency inputs, show the formatted representation when the user is
    // not actively editing, and the raw numeric string while they type.
    const displayValue = React.useMemo(() => {
      if (!isCurrency) return rawValue;
      if (focused) return rawValue;
      if (rawValue === '') return '';
      return formatCurrencyValue(rawValue, currency);
    }, [isCurrency, rawValue, focused, currency]);

    const hintText = hint ?? helperText;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let nextValue = e.target.value;
      if (isCurrency) {
        nextValue = parseCurrencyInput(nextValue);
        // Build a synthetic event that carries the parsed numeric string so
        // consumers always see the canonical value in their onChange handlers.
        const syntheticEvent = {
          ...e,
          target: { ...e.target, value: nextValue },
          currentTarget: { ...e.currentTarget, value: nextValue },
        } as React.ChangeEvent<HTMLInputElement>;
        if (!isControlled) setInternalUncontrolled(nextValue);
        onChange?.(syntheticEvent);
        return;
      }
      if (!isControlled) setInternalUncontrolled(nextValue);
      onChange?.(e);
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {label}
            {required && <span className="ml-1 text-destructive">*</span>}
          </label>
        )}
        <div
          className={cn(
            'flex w-full items-stretch rounded-md border border-input bg-background ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus-within:ring-destructive'
          )}
        >
          {prefix !== undefined && (
            <div
              className="flex items-center border-r border-input bg-muted px-3 text-sm text-muted-foreground"
              aria-hidden={typeof prefix === 'string' ? 'true' : undefined}
            >
              {prefix}
            </div>
          )}
          <div className="relative flex-1">
            {leftIcon && (
              <div
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              >
                {leftIcon}
              </div>
            )}
            <input
              id={inputId}
              type={resolvedType}
              value={displayValue}
              onChange={handleChange}
              onBlur={(e) => {
                setFocused(false);
                onBlur?.(e);
              }}
              onFocus={(e) => {
                setFocused(true);
                onFocus?.(e);
              }}
              className={cn(
                'flex w-full bg-transparent file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                sizeClasses[inputSize],
                leftIcon && 'pl-10',
                (rightIcon || isPassword) && 'pr-10',
                // When hosted inside the outer border we drop the individual
                // border so the prefix/suffix visually seam together.
                prefix !== undefined ? 'border-l-0' : '',
                suffix !== undefined ? 'border-r-0' : '',
                className
              )}
              ref={ref}
              aria-invalid={error}
              aria-label={ariaLabel}
              aria-describedby={
                error && errorMessage
                  ? `${inputId}-error`
                  : hintText
                  ? `${inputId}-helper`
                  : undefined
              }
              required={required}
              {...inputProps}
              {...props}
            />
            {isPassword && (
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                tabIndex={0}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            )}
            {rightIcon && !isPassword && (
              <div
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              >
                {rightIcon}
              </div>
            )}
          </div>
          {suffix !== undefined && (
            <div
              className="flex items-center border-l border-input bg-muted px-3 text-sm text-muted-foreground"
              aria-hidden={typeof suffix === 'string' ? 'true' : undefined}
            >
              {suffix}
            </div>
          )}
        </div>
        {error && errorMessage && (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-xs text-destructive">
            {errorMessage}
          </p>
        )}
        {!error && hintText && (
          <p id={`${inputId}-helper`} className="mt-1.5 text-xs text-muted-foreground">
            {hintText}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

/** Textarea component with validation support */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Show error state styling */
  error?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Helper text below textarea */
  helperText?: string;
  /** Label for the textarea */
  label?: string;
  /** Required field indicator */
  required?: boolean;
  /** Auto-resize based on content */
  autoResize?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      error,
      errorMessage,
      helperText,
      label,
      required,
      autoResize = false,
      id,
      onChange,
      ...props
    },
    ref
  ) => {
    const textareaId = id || React.useId();
    const internalRef = React.useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as React.RefObject<HTMLTextAreaElement>) || internalRef;

    const handleResize = React.useCallback(() => {
      if (autoResize && textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      }
    }, [autoResize, textareaRef]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleResize();
      onChange?.(e);
    };

    React.useEffect(() => {
      handleResize();
    }, [handleResize]);

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            {label}
            {required && <span className="ml-1 text-destructive">*</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-destructive focus-visible:ring-destructive',
            autoResize && 'resize-none overflow-hidden',
            className
          )}
          ref={textareaRef}
          aria-invalid={error}
          aria-describedby={
            error && errorMessage
              ? `${textareaId}-error`
              : helperText
              ? `${textareaId}-helper`
              : undefined
          }
          required={required}
          onChange={handleChange}
          {...props}
        />
        {error && errorMessage && (
          <p id={`${textareaId}-error`} className="mt-1.5 text-xs text-destructive">
            {errorMessage}
          </p>
        )}
        {!error && helperText && (
          <p id={`${textareaId}-helper`} className="mt-1.5 text-xs text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

export { Input, Textarea };
