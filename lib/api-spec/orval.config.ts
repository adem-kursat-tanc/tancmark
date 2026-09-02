import { defineConfig, InputTransformerFn } from "orval";
import { readFile, writeFile } from "node:fs/promises";
import path from "path";

const root = path.resolve(__dirname, "..", "..");
const apiClientReactSrc = path.resolve(root, "lib", "api-client-react", "src");
const apiZodSrc = path.resolve(root, "lib", "api-zod", "src");

const publicBarrels = {
  apiClientReact: [
    'export * from "./generated/api";',
    'export * from "./generated/api.schemas";',
    'export {',
    '  setBaseUrl,',
    '  setAuthTokenGetter,',
    '  setExtraHeadersGetter,',
    '} from "./custom-fetch";',
    'export type { AuthTokenGetter } from "./custom-fetch";',
    '',
  ].join("\n"),
  apiZod: [
    'export * from "./generated/api";',
    'export * as Types from "./generated/types";',
    'export * from "./canonicalDna";',
    '',
  ].join("\n"),
};

// Orval 8.22 appends workspace exports to an existing package barrel. Restore
// the reviewed public barrels after generation so repeated codegen is byte-stable.
const normalizeFinalNewline = async (filePath: string) => {
  const content = await readFile(filePath, "utf8");
  await writeFile(filePath, `${content.trimEnd()}\n`, "utf8");
};

const restoreApiClientReactBarrel = async () => {
  await Promise.all([
    writeFile(path.resolve(apiClientReactSrc, "index.ts"), publicBarrels.apiClientReact, "utf8"),
    normalizeFinalNewline(path.resolve(apiClientReactSrc, "generated", "api.ts")),
    normalizeFinalNewline(path.resolve(apiClientReactSrc, "generated", "api.schemas.ts")),
  ]);
};
const restoreApiZodBarrel = async () => {
  await Promise.all([
    writeFile(path.resolve(apiZodSrc, "index.ts"), publicBarrels.apiZod, "utf8"),
    normalizeFinalNewline(path.resolve(apiZodSrc, "generated", "api.ts")),
  ]);
};

// Our exports make assumptions about the title of the API being "Api" (i.e. generated output is `api.ts`).
const titleTransformer: InputTransformerFn = (config) => {
  config.info ??= {};
  config.info.title = "Api";

  return config;
};

export default defineConfig({
  "api-client-react": {
    hooks: {
      afterAllFilesWrite: restoreApiClientReactBarrel,
    },
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiClientReactSrc,
      target: "generated",
      client: "react-query",
      mode: "split",
      baseUrl: "/api",
      clean: true,
      prettier: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
        mutator: {
          path: path.resolve(apiClientReactSrc, "custom-fetch.ts"),
          name: "customFetch",
        },
      },
    },
  },
  zod: {
    hooks: {
      afterAllFilesWrite: restoreApiZodBarrel,
    },
    input: {
      target: "./openapi.yaml",
      override: {
        transformer: titleTransformer,
      },
    },
    output: {
      workspace: apiZodSrc,
      client: "zod",
      target: "generated",
      schemas: { path: "generated/types", type: "typescript" },
      mode: "split",
      clean: true,
      prettier: true,
      override: {
        zod: {
          version: 3,
          generateEachHttpStatus: true,
          strict: {
            body: true,
          },
          coerce: {
            query: ['boolean', 'number', 'string'],
            param: ['boolean', 'number', 'string'],
            body: ['bigint', 'date'],
            response: ['bigint', 'date'],
          },
        },
        useDates: true,
        useBigInt: true,
      },
    },
  },
});
