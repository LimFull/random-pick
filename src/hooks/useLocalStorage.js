import { useState, useCallback } from 'react';

/**
 * 로컬 스토리지를 사용하는 커스텀 훅
 * 
 * @param {string} key - 로컬 스토리지 키
 * @param {any} initialValue - 초기값
 * @returns {[any, function]} [값, 값 설정 함수]
 */
export function useLocalStorage(key, initialValue) {
  // 초기값을 가져오는 함수
  const [storedValue, setStoredValue] = useState(() => {
    try {
      // 로컬 스토리지에서 값을 가져옴
      const item = window.localStorage.getItem(key);
      // 값이 있으면 파싱하여 반환, 없으면 초기값 반환
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      // 에러 발생 시 초기값 반환
      console.error(`로컬 스토리지에서 ${key} 읽기 실패:`, error);
      return initialValue;
    }
  });

  // 값을 설정하는 함수 (useCallback으로 메모이제이션하여 안정적인 참조 유지)
  const setValue = useCallback((value) => {
    try {
      setStoredValue((currentValue) => {
        // 함수인 경우 (예: setValue(prev => prev + 1))
        const valueToStore = value instanceof Function ? value(currentValue) : value;
        // 로컬 스토리지에 저장
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        return valueToStore;
      });
    } catch (error) {
      console.error(`로컬 스토리지에 ${key} 저장 실패:`, error);
    }
  }, [key]);

  return [storedValue, setValue];
}

