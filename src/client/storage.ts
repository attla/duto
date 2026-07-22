import { emit, on } from 't0n'

interface IStoreChange<TValue> {
  key: string,
  val: TValue | null,
  old: TValue | null,
}

type IStoreListener<TValue> = (change: IStoreChange<TValue>) => void

/**
 * Store reativo que encapsula o localStorage.
 *
 * - Nenhum componente toca em `window.localStorage` diretamente, só nesta classe.
 * - Mudanças feitas via `.set()`/`.remove()` disparam eventos na mesma aba.
 * - Mudanças feitas em outras abas chegam via evento nativo `storage` e são
 *   normalizadas para o mesmo formato de evento.
 * - Chaves e valores são tipados a partir de um schema (`TSchema`), evitando
 *   strings soltas e `JSON.parse`/`JSON.stringify` espalhados pelo código.
 */
class LocalStore<TSchema extends Record<string, unknown>> extends EventTarget {
  #prefix: string

  constructor(prefix = '') {
    super()
    this.#prefix = prefix

    if (typeof window !== 'undefined')
      window.addEventListener('storage', this.#onCrossTabChange)
  }

  #buildKey<K extends keyof TSchema & string>(key: K): string {
    return this.#prefix ? `${this.#prefix}:${key}` : key
  }

  #parse<TValue>(raw: string | null): TValue | null {
    if (raw === null) return null

    try {
      return JSON.parse(raw) as TValue
    } catch {
      return raw as unknown as TValue
    }
  }

  #onCrossTabChange = (e: StorageEvent): void => {
    if (!e.key) return

    const hasPrefix = this.#prefix.length > 0
    const expectedPrefix = `${this.#prefix}:`

    if (hasPrefix && !e.key.startsWith(expectedPrefix)) return

    const key = hasPrefix ? e.key.slice(expectedPrefix.length) : e.key
    const val = this.#parse<TSchema[keyof TSchema]>(e.newValue)
    const old = this.#parse<TSchema[keyof TSchema]>(e.oldValue)

    emit(key, { key, val, old })
  }

  get<K extends keyof TSchema & string>(key: K): TSchema[K] | null {
    if (typeof window === 'undefined') return null

    return this.#parse<TSchema[K]>(window?.localStorage?.getItem(this.#buildKey(key)))
  }

  set<K extends keyof TSchema & string>(key: K, val: TSchema[K]): void {
    if (typeof window === 'undefined') return

    const old = this.get(key)
    window?.localStorage?.setItem(this.#buildKey(key), JSON.stringify(val))

    emit(key, { key, val, old })
  }

  remove<K extends keyof TSchema & string>(key: K): void {
    if (typeof window === 'undefined') return

    const old = this.get(key)
    window?.localStorage?.removeItem(this.#buildKey(key))
    emit(key, { key, val: null, old })
  }

  subscribe<K extends keyof TSchema & string>(
    key: K,
    listener: IStoreListener<TSchema[K]>,
  ) {
    return on(key, listener)
  }
}

export const local = new LocalStore()

export { LocalStore }
export type { IStoreChange }
