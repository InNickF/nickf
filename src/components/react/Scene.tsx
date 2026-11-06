import { modifyHSL } from "@/utils";
import {
  Environment,
  Lightformer,
  MeshTransmissionMaterial,
  PerformanceMonitor,
  useTexture,
} from "@react-three/drei";
import {
  Canvas,
  useFrame,
  type CanvasProps,
  type Vector3 as TVector3,
} from "@react-three/fiber";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import {
  BallCollider,
  CuboidCollider,
  Physics,
  RapierCollider,
  RapierRigidBody,
  RigidBody,
} from "@react-three/rapier";
import { easing } from "maath";
import { useEffect, useMemo, useRef, useState } from "react";
import { MathUtils, Mesh, Vector3 } from "three";
import useInView from "./hooks/useInView";
import { detectQuality, type Quality } from "./quality";
import useThemeEvent from "./hooks/useThemeEvent";
import { getDocumentStyles } from "./utils";
interface ShuffleParams {
  color?: string;
  activeTheme?: number;
  currentHue?: string;
}

const shuffle = ({
  activeTheme = 0,
  color = "hsl(350, 23%, 40%)",
  currentHue = "350",
}: ShuffleParams) => {
  const isFirstTheme = activeTheme === 0;
  const newColor = modifyHSL(
    color,
    {
      s: (s) => (isFirstTheme ? s + 2 : s - 0.2),
      l: (l) => (isFirstTheme ? l + 15 : l - 20),
    },
    currentHue,
  );

  return [
    { color: "#444", isSquared: isFirstTheme },
    { color: "#444", isSquared: isFirstTheme },
    { color: "#444", isSquared: isFirstTheme },
    { color: "#444", isSquared: isFirstTheme },
    { color: "#fff", isSquared: isFirstTheme },
    { color: "#fff", isSquared: isFirstTheme },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
    {
      color: newColor,
      isSquared: isFirstTheme,
      metalness: Math.random(),
      roughness: Math.random(),
    },
  ];
};

export function Scene({ className, ...props }: CanvasProps) {
  // The device tier is decided once, at load, and never changes: switching it
  // would remount materials/passes (shader compile + buffer allocation = stalls).
  // It only picks cheaper SETTINGS; every cube, shadow and light is always there.
  const [quality] = useState<Quality>(detectQuality);
  const perfSucks = quality === "low";
  const [wrapperRef, inView] = useInView<HTMLDivElement>();

  // At runtime the monitor may only toggle ambient occlusion (the soft contact
  // shadows), via the composer's `enabled` flag: no remount, so it's free to
  // switch back on when fps recovers.
  const [aoOn, setAoOn] = useState(true);

  // Only judge fps once things have settled: load, shader compiles and the
  // intro produce slow frames that are not representative. Unmounting the
  // monitor while off-screen also resets it, so the paused gap isn't
  // measured as one giant "slow frame" when the hero scrolls back in.
  const [monitorReady, setMonitorReady] = useState(false);
  useEffect(() => {
    if (!inView) {
      setMonitorReady(false);
      return;
    }
    const id = setTimeout(() => setMonitorReady(true), 3000);
    return () => clearTimeout(id);
  }, [inView]);
  const [connectors, setConnectors] = useState(shuffle({}));
  useThemeEvent(() => {
    const { activeTheme, color, currentHue } = getDocumentStyles();
    const newConnectors = shuffle({ activeTheme, color, currentHue });
    setConnectors(newConnectors);
  });
  const getClasses = () => {
    return `react-scene ${className}`;
  };

  return (
    <div ref={wrapperRef} className="h-full w-full">
      <Canvas
        gl={{
          alpha: true,
          antialias: true,
        }}
        className={getClasses()}
        shadows
        dpr={perfSucks ? 1 : [1, 1.5]}
        // Stop rendering (and the physics step) while the hero is off-screen.
        frameloop={inView ? "always" : "never"}
        camera={{ position: [20, 1, 15], fov: 18, near: 1, far: 50 }}
        {...props}
      >
        {monitorReady && (
          <PerformanceMonitor
            flipflops={4}
            onDecline={() => setAoOn(false)}
            onIncline={() => setAoOn(true)}
            onFallback={() => setAoOn(false)}
          />
        )}
        <Lights />
        <Controls />
        <Physics gravity={[0, 0, 0]}>
          <Pointer />
          {connectors.map((props, i) => (
            <PhysicsElement key={i} {...props} />
          ))}
          <ExtraShapes
            perfSucks={perfSucks}
            isSquared={connectors[0]?.isSquared}
          />
        </Physics>

        <Envs />
        <Effects lowTier={perfSucks} enabled={aoOn} />
      </Canvas>
    </div>
  );
}
interface EffectsProps {
  lowTier?: boolean;
  enabled?: boolean;
}
// Always mounted (never remounted). `enabled={false}` just skips the pass and
// lets R3F render normally. Weak devices get half-resolution AO instead of none.
function Effects({ lowTier, enabled = true }: EffectsProps) {
  return (
    <EffectComposer multisampling={lowTier ? 0 : 4} enabled={enabled}>
      <N8AO
        distanceFalloff={10}
        aoRadius={10}
        intensity={8}
        halfRes={lowTier}
        quality={lowTier ? "performance" : "medium"}
      />
    </EffectComposer>
  );
}

// Lights + environment only affect the glass shapes. The env map is rendered
// once (frames=1 by default), so it's cheap enough to keep on every tier.
function Envs() {
  return (
    <Environment resolution={128}>
      <group rotation={[-Math.PI / 3, 0, 1]}>
        <Lightformer
          form="circle"
          intensity={4}
          rotation-x={Math.PI / 2}
          position={[0, 5, -9]}
          scale={4}
        />
        <Lightformer
          form="circle"
          intensity={2}
          rotation-y={Math.PI / 2}
          position={[-5, 1, -1]}
          scale={2}
        />
        <Lightformer
          form="circle"
          intensity={2}
          rotation-y={Math.PI / 2}
          position={[-5, -1, -1]}
          scale={2}
        />
        <Lightformer
          form="circle"
          intensity={2}
          rotation-y={-Math.PI / 2}
          position={[10, 1, 0]}
          scale={8}
        />
      </group>
    </Environment>
  );
}

function Controls() {
  useFrame((state, delta) => {
    const y = state.pointer.y * 10 > 4 ? 4 : state.pointer.y * 10;
    easing.damp3(
      state.camera.position,
      [Math.sin(state.pointer.x) * 15, state.pointer.y * 15, 15],
      0.5,
      delta,
    );
    state.camera.lookAt(0, 0, 0);
  });
  return null;
}

function ExtraShapes({
  perfSucks,
  isSquared,
}: {
  perfSucks?: boolean;
  isSquared: boolean;
}) {
  return (
    <>
      <PhysicsElement position={[-10, -10, 10]} isSquared={isSquared}>
        <SecondModel isSquared={isSquared} lowQuality={perfSucks} />
      </PhysicsElement>
      {/* Always rendered: removing bodies changes the composition. */}
      <PhysicsElement position={[10, 10, 10]} isSquared={isSquared}>
        <SecondModel isSquared={isSquared} lowQuality={perfSucks} />
      </PhysicsElement>
    </>
  );
}

function Lights() {
  return (
    <>
      <ambientLight intensity={3} />
      <spotLight
        position={[10, 10, 10]}
        angle={0.15}
        penumbra={1}
        intensity={1}
        castShadow
      />
    </>
  );
}

function PhysicsElement({
  position,
  children,
  vec = new Vector3(),
  scale,
  r = MathUtils.randFloatSpread,
  perfSucks,
  ...props
}: {
  position?: TVector3;
  children?: React.ReactNode;
  vec?: Vector3;
  scale?: number;
  r?: (value: number) => number;
  color?: string;
  isSquared: boolean;
  perfSucks?: boolean;
} & React.ComponentProps<typeof RigidBody>) {
  const api = useRef<RapierRigidBody>(null!);
  const pos = useMemo(() => position || [r(12), r(12), r(12)], []) as Vector3;
  useFrame((state, delta) => {
    delta = Math.min(0.1, delta);
    api.current?.applyImpulse(
      vec.copy(api.current.translation()).negate().multiplyScalar(0.01),
      true,
    );
  });
  return (
    <RigidBody
      linearDamping={20}
      angularDamping={1}
      friction={1}
      position={pos}
      ref={api}
      colliders={false}
    >
      {props.isSquared ? (
        <CuboidCollider args={[0.22, 0.22, 0.22]} />
      ) : (
        <BallCollider args={[0.3]} />
      )}

      {children ? children : <Model {...props} />}
    </RigidBody>
  );
}

function Pointer({ vec = new Vector3() }) {
  const ref = useRef<RapierRigidBody>(null!);
  const colliderRef = useRef<RapierCollider>(null!);
  useThemeEvent(() => {
    ref.current?.setNextKinematicTranslation(vec.set(0, 0, 0));
    colliderRef.current?.setRadius(2);
    setTimeout(() => {
      colliderRef.current?.setRadius(0.4);
    }, 150);
  });
  useFrame(({ viewport, pointer }) => {
    ref.current?.setNextKinematicTranslation(
      vec.set(
        (pointer.x * viewport.width) / 2,
        (pointer.y * viewport.height) / 2,
        0,
      ),
    );
  });
  return (
    <RigidBody
      position={[10, 10, 0]}
      type="kinematicPosition"
      colliders={false}
      ref={ref}
    >
      <BallCollider ref={colliderRef} args={[0.2]} />
    </RigidBody>
  );
}

function Model({
  children,
  color = "white",
  metalness = 0.4,
  roughness = 1,
  perfSucks,
  ...props
}: {
  children?: React.ReactNode;
  color?: string;
  isSquared: boolean;
  metalness?: number;
  roughness?: number;
  perfSucks?: boolean;
} & React.ComponentProps<typeof RigidBody>) {
  const ref = useRef<Mesh>(null!);
  useFrame((state, delta) => {
    easing.dampC((ref.current.material as any).color, color, 0.2, delta);
  });
  const displacement = useTexture("/displacement.jpg");
  return (
    <mesh ref={ref} castShadow receiveShadow>
      {props.isSquared ? (
        <boxGeometry args={[0.45, 0.45, 0.45]} />
      ) : (
        <sphereGeometry args={[0.3]} />
      )}
      {perfSucks ? null : <meshBasicMaterial map={displacement} />}
      {children}
    </mesh>
  );
}

function SecondModel({
  children,
  isSquared = false,
  lowQuality = false,
}: {
  children?: React.ReactNode;
  isSquared?: boolean;
  lowQuality?: boolean;
}) {
  const displacement = useTexture("/displacement.jpg");
  return (
    <Model isSquared={isSquared}>
      <MeshTransmissionMaterial
        clearcoat={5}
        thickness={0.4}
        anisotropicBlur={0.5}
        chromaticAberration={0.5}
        // Low tier: fewer blur samples and a smaller transmission buffer.
        samples={lowQuality ? 3 : 6}
        resolution={lowQuality ? 128 : 256}
        map={displacement}
      />
    </Model>
  );
}
