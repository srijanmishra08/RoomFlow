// draco3dgltf ships Emscripten glue without TypeScript declarations.
declare module "draco3dgltf" {
  const draco3d: {
    createEncoderModule: (opts?: Record<string, unknown>) => Promise<unknown>;
    createDecoderModule: (opts?: Record<string, unknown>) => Promise<unknown>;
  };
  export default draco3d;
}
