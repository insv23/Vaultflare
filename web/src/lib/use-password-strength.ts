// input: @zxcvbn-ts/core + language-common + language-en（懒加载）
// output: usePasswordStrength hook — 返回密码强度评估结果 { score, warning, suggestions }
// pos: 被 PasswordStrengthBar 组件消费，提供密码强度评估能力
// 一旦我被更新，务必更新我的开头注释，以及所属的文件夹的md。

import { useState, useEffect, useRef } from "react";

type StrengthResult = {
  score: 0 | 1 | 2 | 3 | 4;
  warning: string;
  suggestions: string[];
};

export function usePasswordStrength(password: string): StrengthResult | null {
  const [result, setResult] = useState<StrengthResult | null>(null);
  const zxcvbnRef = useRef<typeof import("@zxcvbn-ts/core").zxcvbn | null>(null);
  const initPromise = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!password) {
      setResult(null);
      return;
    }

    // 懒初始化：首次调用时加载字典
    if (!initPromise.current) {
      initPromise.current = (async () => {
        const [{ zxcvbn, zxcvbnOptions }, common, en] = await Promise.all([
          import("@zxcvbn-ts/core"),
          import("@zxcvbn-ts/language-common"),
          import("@zxcvbn-ts/language-en"),
        ]);
        zxcvbnOptions.setOptions({
          translations: en.translations,
          graphs: common.adjacencyGraphs,
          dictionary: { ...common.dictionary, ...en.dictionary },
        });
        zxcvbnRef.current = zxcvbn;
      })();
    }

    // 加载完成后评估
    initPromise.current.then(() => {
      if (!zxcvbnRef.current) return;
      const r = zxcvbnRef.current(password);
      setResult({
        score: r.score as StrengthResult["score"],
        warning: r.feedback.warning ?? "",
        suggestions: r.feedback.suggestions ?? [],
      });
    });
  }, [password]);

  return result;
}
