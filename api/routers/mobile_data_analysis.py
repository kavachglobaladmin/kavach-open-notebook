"""
Mobile / CDR / SMS dump analysis endpoint.
Parses telecom-style CSV or text exports via open_i_Notes.mobile_data.pipeline.
Results are cached in the analysis_cache table — subsequent calls return the cached
result unless force_refresh=true is passed.
"""
from fastapi import APIRouter, HTTPException
from loguru import logger
from pprint import pprint
import traceback

from i_Notes.domain.i_Notes import Source
from api.routers.bank_analysis import _load_cached_analysis, _save_cached_analysis

router = APIRouter()

_ANALYSIS_TYPE = "mobile_cdr"
_UI_SCHEMA_VERSION = "mobile-cdr-v5"


def _print_section(title: str) -> None:
    """Small helper only for readable terminal/debug output."""
    print("=" * 100)
    print(title)
    print("=" * 100)


def _preview_text(value: str, limit: int = 500) -> str:
    """Return a safe one-line-ish preview for print debugging."""
    if not value:
        return ""
    return value[:limit].replace("\r", " ").replace("\n", " ")


@router.get("/sources/{source_id}/mobile-analysis")
async def get_mobile_analysis_cached(source_id: str):
    """
    Return the cached mobile/CDR analysis result for a source.
    Returns 404 if no analysis has been run yet.
    """
    _print_section("[MOBILE_ANALYSIS][GET] START")
    print(f"[MOBILE_ANALYSIS][GET] source_id={source_id}")
    print(f"[CACHE] Loading cached analysis for analysis_type={_ANALYSIS_TYPE}")

    cached = await _load_cached_analysis(source_id, _ANALYSIS_TYPE)
    if cached is None:
        print("[CACHE] Cache MISS")
        print("[MOBILE_ANALYSIS][GET] No cached analysis found")
        raise HTTPException(
            status_code=404,
            detail="No cached analysis found. Run the analysis first via POST."
        )

    print("[CACHE] Cache HIT")
    print(f"[CACHE] Cached result type={type(cached).__name__}")
    if isinstance(cached, dict):
        print(f"[CACHE] Cached result keys={list(cached.keys())}")
        print(f"[CACHE] Cached total_records={cached.get('total_records')}")
    if isinstance(cached, dict):
        cached["source_id"] = cached.get("source_id") or source_id
        if cached.get("ui_schema_version") != _UI_SCHEMA_VERSION:
            print("[CACHE] Cached result uses an older UI schema. Returning 404 so frontend can regenerate.")
            raise HTTPException(
                status_code=404,
                detail="Cached mobile analysis is outdated. Run the analysis again via POST.",
            )
    print("[MOBILE_ANALYSIS][GET] Returning cached result")
    print("[MOBILE_ANALYSIS][GET] END")
    print("=" * 100)
    return cached


@router.post("/sources/{source_id}/mobile-analysis")
async def analyze_mobile_data(
    source_id: str,
    force_refresh: bool = False,
    debug: bool = True,
):
    """
    Run heuristic mobile-data analysis on a source (calls, SMS-ish rows in CSV/text).
    Results are cached in the database — subsequent calls return the cached result
    unless force_refresh=true is passed.

    debug=true prints the intermediate input/output structure to the server console.
    """
    try:
        _print_section("[MOBILE_ANALYSIS][POST] START")
        print(f"[MOBILE_ANALYSIS] source_id={source_id}")
        print(f"[MOBILE_ANALYSIS] force_refresh={force_refresh}")
        print(f"[MOBILE_ANALYSIS] debug={debug}")
        print(f"[MOBILE_ANALYSIS] analysis_type={_ANALYSIS_TYPE}")

        # ── Return cached result if available and not forcing refresh ────────
        if not force_refresh:
            print("[CACHE] Checking cached analysis...")
            cached = await _load_cached_analysis(source_id, _ANALYSIS_TYPE)
            if cached is not None:
                print("[CACHE] Cache HIT")
                print(f"[CACHE] Returning cached result for source_id={source_id}")
                if isinstance(cached, dict):
                    print(f"[CACHE] Cached result keys={list(cached.keys())}")
                    print(f"[CACHE] Cached total_records={cached.get('total_records')}")
                if isinstance(cached, dict):
                    cached["source_id"] = cached.get("source_id") or source_id
                    if cached.get("ui_schema_version") != _UI_SCHEMA_VERSION:
                        print("[CACHE] Cached result uses an older UI schema. Regenerating analysis instead of returning cache.")
                    else:
                        logger.info(f"[MobileAnalysis] Returning cached result for {source_id}")
                        print("[MOBILE_ANALYSIS][POST] END - cached")
                        print("=" * 100)
                        return cached
                else:
                    logger.info(f"[MobileAnalysis] Returning cached result for {source_id}")
                    print("[MOBILE_ANALYSIS][POST] END - cached")
                    print("=" * 100)
                    return cached
            print("[CACHE] Cache MISS")
        else:
            print("[CACHE] Skipping cache lookup because force_refresh=True")

        print("[SOURCE] Loading source...")
        source = await Source.get(source_id)
        if not source:
            print("[SOURCE] Source not found")
            raise HTTPException(status_code=404, detail="Source not found")

        print("[SOURCE] Source Loaded")
        print(f"[SOURCE] Title={source.title}")
        print(f"[SOURCE] Asset Exists={bool(source.asset)}")
        print(f"[SOURCE] Full Text Exists={bool(source.full_text)}")
        print(f"[SOURCE] Full Text Length={len(source.full_text or '')}")

        file_path = None
        if source.asset and source.asset.file_path:
            file_path = source.asset.file_path

        print(f"[FILE] file_path={file_path}")

        full_text = (source.full_text or "").strip()
        blob = ""

        import asyncio
        from i_Notes.mobile_data.pipeline import (
            build_searchable_text,
            read_file_text,
            run_pipeline_from_text,
            sniff_maybe_mobile,
        )

        if file_path:
            print("[FILE] Reading text from file_path...")
            blob = read_file_text(str(file_path))
            print("[FILE] File Read Complete")
            print(f"[FILE] Characters Read={len(blob)}")
            print(f"[FILE] Preview={_preview_text(blob, 500)}")

        if not blob.strip() and full_text:
            print("[SOURCE] File text empty. Using source.full_text fallback")
            blob = full_text
            print(f"[SOURCE] full_text length={len(full_text)}")
            print(f"[SOURCE] full_text preview={_preview_text(full_text, 500)}")

        print(f"[INPUT] Final blob length={len(blob)}")
        print(f"[INPUT] Final blob has content={bool(blob.strip())}")

        if not blob.strip():
            print("[INPUT] No text content available for analysis")
            raise HTTPException(
                status_code=400,
                detail="No text content available. Upload a CSV / TXT CDR or SMS export.",
            )

        title = source.title or ""
        print("[DETECTION] Running mobile data detection...")
        is_mobile = sniff_maybe_mobile(
            title,
            str(file_path) if file_path else "",
            blob[:16000],
        )
        print(f"[DETECTION] is_mobile={is_mobile}")

        if not is_mobile:
            logger.info(
                f"mobile-analysis: source {source_id} does not look like CDR/SMS data — running parser anyway"
            )
            print(
                f"[DETECTION] Source {source_id} does not look like CDR/SMS data — running parser anyway"
            )

        print("[PIPELINE] Starting analysis...")
        print("[PIPELINE] Calling run_pipeline_from_text")

        try:
            result = await asyncio.to_thread(run_pipeline_from_text, blob, debug=debug)
        except TypeError:
            # Backward compatibility if the deployed pipeline does not yet accept debug.
            print("[PIPELINE] run_pipeline_from_text does not accept debug parameter. Retrying without debug...")
            result = await asyncio.to_thread(run_pipeline_from_text, blob)

        print("[PIPELINE] Analysis completed")
        print(f"[PIPELINE] Result type={type(result).__name__}")
        if isinstance(result, dict):
            print(f"[PIPELINE] Result Keys={list(result.keys())}")
        else:
            print("[PIPELINE] Warning: result is not a dict")

        if debug:
            _print_section("[PIPELINE] FULL RESULT")
            pprint(result)
            print("=" * 100)

        if isinstance(result, dict):
            result["source_id"] = source_id
            result["ui_schema_version"] = _UI_SCHEMA_VERSION
            if "dynamic_fields" in result and "detected_fields" not in result:
                result["detected_fields"] = result.get("dynamic_fields")

        total = int(result.get("total_records") or 0)
        logger.info(f"Mobile data analysis for {source_id}: {total} parsed rows")

        print("[SUMMARY]")
        print(f"[SUMMARY] Total Records={total}")
        if isinstance(result.get("summary"), dict):
            print("[SUMMARY] Summary payload:")
            pprint(result["summary"])

        print("[REPORTS] Dynamic report overview")
        for key, value in result.items():
            if isinstance(value, list):
                print(f"[REPORT] {key}: list with {len(value)} records")
            elif isinstance(value, dict):
                print(f"[REPORT] {key}: dict with {len(value.keys())} keys")
            else:
                print(f"[REPORT] {key}: {type(value).__name__}")

        if total == 0:
            hint = result.get("error_hint") or "Could not parse rows."
            print(f"[PIPELINE] No records parsed. hint={hint}")
            raise HTTPException(
                status_code=422,
                detail=(
                    f"{hint} Export should include communication identifiers such as phone numbers "
                    "and optionally dates / duration / direction columns."
                ),
            )

        # Helpful denormalised preview for debugging / future UI
        print("[SEARCHABLE_STUB] Generating searchable text stub...")
        result["_searchable_stub"] = build_searchable_text(result)
        print("[SEARCHABLE_STUB] Generated")
        print(result["_searchable_stub"][:2000])

        # ── Persist result to database cache ─────────────────────────────────
        print("[CACHE] Saving analysis result...")
        await _save_cached_analysis(source_id, _ANALYSIS_TYPE, result)
        print("[CACHE] Analysis saved successfully")

        print("[API] Returning response")
        print(f"[API] Total Records={total}")
        print("[MOBILE_ANALYSIS][POST] END")
        print("=" * 100)
        return result

    except HTTPException:
        print("[HTTP_EXCEPTION] Raising HTTPException without wrapping")
        raise
    except Exception as e:
        _print_section("[ERROR] MOBILE ANALYSIS FAILED")
        print(f"source_id={source_id}")
        print(f"error={str(e)}")
        traceback.print_exc()
        print("=" * 100)

        logger.error(f"Mobile analysis failed for {source_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Mobile analysis failed: {str(e)}")
