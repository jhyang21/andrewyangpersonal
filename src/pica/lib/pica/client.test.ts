/** Type checks for the client contract. `tsc --noEmit` enforces these. */
import { describe, expectTypeOf, it } from "vitest";
import type {
  AskQuestionOutput,
  CompareProductsOutput,
  PresentShortlistOutput,
  SearchCatalogOutput,
  UpdateCanvasOutput,
} from "@/pica/lib/types";
import type { PicaUITools } from "./client";

describe("PicaUITools", () => {
  it("types each tool's output as the shared contract", () => {
    expectTypeOf<PicaUITools["update_canvas"]["output"]>().toEqualTypeOf<UpdateCanvasOutput>();
    expectTypeOf<PicaUITools["ask_question"]["output"]>().toEqualTypeOf<AskQuestionOutput>();
    expectTypeOf<PicaUITools["search_catalog"]["output"]>().toEqualTypeOf<SearchCatalogOutput>();
    expectTypeOf<PicaUITools["present_shortlist"]["output"]>().toEqualTypeOf<PresentShortlistOutput>();
    expectTypeOf<PicaUITools["compare_products"]["output"]>().toEqualTypeOf<CompareProductsOutput>();
  });
});
