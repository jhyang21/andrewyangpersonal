"""CLI for the cup note simulation. See README.md for the stage order."""

from __future__ import annotations

import argparse

from cupnotes import batch, compile

STAGES_AND_PROBE = (*batch.STAGES, batch.PROBE)


def main() -> None:
    parser = argparse.ArgumentParser(prog="run.py")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("build").add_argument("stage", choices=batch.STAGES)
    p = sub.add_parser("submit")
    p.add_argument("stage", choices=STAGES_AND_PROBE)
    p.add_argument("--force", action="store_true", help="resubmit a file that was already sent")
    p = sub.add_parser("poll")
    p.add_argument("stage", choices=STAGES_AND_PROBE)
    p.add_argument("--once", action="store_true", help="check once instead of waiting")
    p.add_argument("--interval", type=int, default=60)
    sub.add_parser("ingest").add_argument("stage", choices=STAGES_AND_PROBE)
    sub.add_parser("compile").add_argument("--fixture", action="store_true")
    sub.add_parser("status")
    p = sub.add_parser("probe")
    p.add_argument("--submit", action="store_true", help="submit the probe file built earlier")
    p.add_argument("--alt", action="store_true", help='use reasoning: {"effort": ...} instead')
    args = parser.parse_args()

    try:
        if args.command == "build":
            batch.build(args.stage)
        elif args.command == "submit":
            batch.submit(args.stage, force=args.force)
        elif args.command == "poll":
            batch.poll(args.stage, interval_s=args.interval, once=args.once)
        elif args.command == "ingest":
            batch.ingest(args.stage)
        elif args.command == "compile":
            compile.run(fixture=args.fixture)
        elif args.command == "status":
            batch.status()
        elif args.command == "probe":
            if args.submit:
                batch.submit(batch.PROBE)
            else:
                batch.build_probe(alt=args.alt)
    except batch.StageError as exc:
        batch.fail(str(exc))


if __name__ == "__main__":
    main()
