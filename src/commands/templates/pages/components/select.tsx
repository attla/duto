import { forwardRef } from 'preact/compat'

type OptionObject = {
  label: string
  value: string
}

type Option =
  | OptionObject
  | [value: string, label: string]

type Props = {
  placeholder?: string,
  value?: string,
  Icon?: any,
  // icon?: string,
  id?: string,
  class?: string,
  containerClass?: string,
  options: Record<string, Option[]> | Option[],
  onchange?: (e: Event) => void,
  onclick?: (e: Event) => void,
  required?: boolean,
  ref?: (el: HTMLSelectElement | null) => void,
}

function renderOption(op: Option, value: string) {
  if (Array.isArray(op)) {
    const [val, label] = op
    return <option key={val} value={val}>{label}</option>
  }

  return <option key={op.value} value={op.value}>{op.label}</option>
}

export default forwardRef<HTMLSelectElement, Props>(function Select({
  placeholder,
  value = '',
  Icon,
  id,
  class: className,
  containerClass,
  options,
  ...props
}, ref) {

  return (
    <label
      htmlFor={id}
      class={[
        'relative inline-flex items-center cursor-pointer select',
        containerClass,
      ].filter(Boolean).join(' ')}
    >
      {Icon && <Icon class="size-6 shrink-0" />}
      {/* {icon && (
        <Icon
          name={icon}
          class="icon label-icon pointer-events-none"
        />
      )} */}

      <select
        ref={ref}
        id={id}
        value={value}
        autocomplete="off"
        class={className}
        {...props}
      >
        {placeholder && (
          <option disabled value="">{placeholder}</option>
        )}

        {Array.isArray(options)
          ? options.map(op => renderOption(op, value))
          : Object.entries(options).map(([label, opts]) => (
              <optgroup
                key={label}
                label={label}
              >
                {opts.map(op => renderOption(op, value))}
              </optgroup>
            ))}
      </select>

      {/* <Icon
        name="lucide:chevron-down"
        class="icon caret"
        style="scale:115% 115%"
      /> */}
    </label>
  )
})

