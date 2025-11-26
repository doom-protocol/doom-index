import type { AppError } from "@/types/app-error";
import { err, ok, type Result } from "neverthrow";
import { type Group, Mesh, type Object3D } from "three";
import { GLTFExporter, GLTFLoader, SimplifyModifier } from "three-stdlib";

interface GLTFResult {
  scene: Group;
  scenes: Group[];
  animations: unknown[];
  cameras: unknown[];
  asset: unknown;
}

interface GlbExportService {
  exportPaintingModel(paintingRef: React.RefObject<Group | null>): Promise<Result<File, AppError>>;
  optimizeGlb(glbBuffer: ArrayBuffer, targetSizeMB: number): Promise<Result<ArrayBuffer, AppError>>;
}

export class GlbExportServiceImpl implements GlbExportService {
  async exportPaintingModel(paintingRef: React.RefObject<Group | null>): Promise<Result<File, AppError>> {
    if (!paintingRef.current) {
      return err({
        type: "ValidationError" as const,
        message: "Painting model reference is null or undefined",
      });
    }

    const paintingGroup = paintingRef.current;

    // Validate that the group contains meshes
    let hasMeshes = false;
    paintingGroup.traverse(child => {
      if (child.type === "Mesh") {
        hasMeshes = true;
      }
    });

    if (!hasMeshes) {
      return err({
        type: "ValidationError" as const,
        message: "No meshes found in painting model",
      });
    }

    // Clone the painting group to avoid modifying the original
    const clonedGroup = paintingGroup.clone(true);

    // Reset rotation to ensure GLB export has correct orientation (facing front)
    clonedGroup.rotation.set(0, 0, 0);

    // Create GLTFExporter instance
    const exporter = new GLTFExporter();

    return new Promise(resolve => {
      exporter.parse(
        clonedGroup,
        (result: ArrayBuffer | object) => {
          if (result instanceof ArrayBuffer) {
            // Create File object from the GLB buffer
            const glbFile = new File([result], `painting-${Date.now()}.glb`, {
              type: "application/octet-stream",
            });

            resolve(ok(glbFile));
          } else {
            resolve(
              err({
                type: "InternalError" as const,
                message: "GLTFExporter returned object instead of ArrayBuffer",
              }),
            );
          }
        },
        (error: unknown) => {
          resolve(
            err({
              type: "InternalError" as const,
              message: `GLB export failed: ${error instanceof Error ? error.message : String(error)}`,
            }),
          );
        },
        { binary: true },
      );
    });
  }

  async optimizeGlb(glbBuffer: ArrayBuffer, targetSizeMB: number): Promise<Result<ArrayBuffer, AppError>> {
    const sizeMB = glbBuffer.byteLength / (1024 * 1024);

    // If already smaller than target, return as is
    if (sizeMB <= targetSizeMB) {
      return ok(glbBuffer);
    }

    try {
      // Load the GLB
      const loader = new GLTFLoader();
      const gltf = await new Promise<GLTFResult>((resolve, reject) => {
        loader.parse(
          glbBuffer,
          "",
          gltf => resolve(gltf),
          err => reject(err),
        );
      });

      // Optimization logic
      const modifier = new SimplifyModifier();

      gltf.scene.traverse((child: Object3D) => {
        if (child instanceof Mesh) {
          const mesh = child as Mesh;
          // Simplify mesh if it has a significant number of vertices
          const count = mesh.geometry.attributes.position.count;
          if (count > 1000) {
            // Threshold for simplification
            const simplified = modifier.modify(mesh.geometry, Math.floor(count * 0.5)); // 50% reduction
            mesh.geometry.dispose();
            mesh.geometry = simplified;
          }
        }
      });

      // Re-export
      const exporter = new GLTFExporter();
      return new Promise(resolve => {
        exporter.parse(
          gltf.scene,
          (result: ArrayBuffer | object) => {
            if (result instanceof ArrayBuffer) {
              resolve(ok(result));
            } else {
              resolve(
                err({
                  type: "InternalError" as const,
                  message: "GLTFExporter returned object during optimization",
                }),
              );
            }
          },
          (error: unknown) => {
            resolve(
              err({
                type: "InternalError" as const,
                message: `Optimization export failed: ${error instanceof Error ? error.message : String(error)}`,
              }),
            );
          },
          { binary: true },
        );
      });
    } catch (error) {
      return err({
        type: "InternalError" as const,
        message: `Optimization failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
}

export const glbExportService: GlbExportService = new GlbExportServiceImpl();
