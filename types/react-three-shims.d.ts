// Temporary shims for @react-three/fiber and Three JSX intrinsic elements
// Replace with proper types from @react-three/fiber when available/compatible.
declare module "@react-three/fiber" {
  import * as React from "react";
  export const Canvas: React.FC<any>;
  export const useFrame: (cb: (...args: any[]) => void) => void;
  export const createPortal: (...args: any[]) => any;
  export const useThree: () => any;
  export const extend: (obj: any) => void;
  const _default: any;
  export default _default;
}

// Minimal shims for @react-three/drei and other helper libs used in the project
declare module "@react-three/drei" {
  import * as React from "react";
  export const Effects: React.FC<any>;
  export const OrbitControls: React.FC<any>;
  export const Html: React.FC<any>;
  export const useTexture: (url: string | string[]) => any;
  export const useFBO: (w: number, h: number, opts?: any) => any;
  export const useGLTF: (url: string) => any;
  const _default: any;
  export default _default;
}

declare module "r3f-perf" {
  import * as React from "react";
  export const Perf: React.FC<any>;
  const _default: any;
  export default _default;
}

declare module "maath/easing" {
  export function damp(target: any, key: string, to: number, lambda: number, delta: number): void;
  export const easing: any;
}

// Provide minimal JSX intrinsic element typings used in the project
declare global {
  namespace JSX {
    interface IntrinsicElements {
      mesh: any;
      group: any;
      sphereGeometry: any;
      planeGeometry: any;
      meshStandardMaterial: any;
      meshBasicMaterial: any;
      ambientLight: any;
      directionalLight: any;
      bufferGeometry: any;
      bufferAttribute: any;
      points: any;
      color: any;
      shaderPass: any;
      // allow unknown elements from drei/postprocessing
      [el: string]: any;
    }
  }
}

export {};
