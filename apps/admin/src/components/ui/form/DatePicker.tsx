import flatpickr from "flatpickr"
import { useEffect, useRef } from "react"
import { twMerge } from "tailwind-merge"

import "flatpickr/dist/flatpickr.css"
import { CalenderIcon } from "@/icons"

import Label from "./Label"

import Hook = flatpickr.Options.Hook
import DateOption = flatpickr.Options.DateOption

type PropsType = {
  /** 見えるラベルが無いときの読み上げ用の名前 */
  ariaLabel?: string;
  defaultDate?: DateOption;
  id: string;
  /** 入力欄に足すクラス（高さなど。同じ種類のクラスは上書きする） */
  inputClassName?: string;
  label?: string;
  mode?: "single" | "multiple" | "range" | "time";
  onChange?: Hook | Hook[];
  placeholder?: string;
  /**
   * 表示する日付（`YYYY-MM-DD`）。渡すと表示をこの値に合わせる（空文字で空にする）
   */
  value?: string;
}

export default function DatePicker({
  ariaLabel,
  defaultDate,
  id,
  inputClassName,
  label,
  mode,
  onChange,
  placeholder,
  value,
}: PropsType) {
  const flatpickrRef = useRef<flatpickr.Instance | null>(null)
  /**
   * onChange は ref に入れて、渡す関数が変わるたびに flatpickr を作り直さない
   */
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    const instance = flatpickr(`#${id}`, {
      dateFormat: "Y-m-d",
      defaultDate,
      mode: mode || "single",
      monthSelectorType: "static",
      onChange: (...args) => {
        const handler = onChangeRef.current
        const handlers = Array.isArray(handler) ? handler : handler ? [handler] : []
        handlers.forEach((h) => h(...args))
      },
      /**
       * カレンダーは body の直下に出す。親（ポップオーバーや表の枠）の overflow で切れないように
       */
      static: false,
    })
    flatpickrRef.current = Array.isArray(instance) ? null : instance

    return () => {
      if (!Array.isArray(instance)) {
        instance.destroy()
      }
    }
  }, [mode, id, defaultDate])

  useEffect(() => {
    if (value === undefined) return
    flatpickrRef.current?.setDate(value === "" ? [] : value, false)
  }, [value])

  return (
    <div>
      {label && <Label htmlFor={id}>{label}</Label>}

      <div className="relative">
        <input
          aria-label={ariaLabel}
          id={id}
          placeholder={placeholder}
          className={twMerge(
            "h-11 w-full rounded-lg border appearance-none px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3  dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30  bg-transparent text-gray-800 border-gray-300 focus:border-brand-300 focus:ring-brand-500/20 dark:border-gray-700  dark:focus:border-brand-800",
            inputClassName,
          )}
        />

        <span className="absolute text-gray-500 -translate-y-1/2 pointer-events-none right-3 top-1/2 dark:text-gray-400">
          <CalenderIcon className="size-6" />
        </span>
      </div>
    </div>
  )
}
