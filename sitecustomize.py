import importlib.abc
import importlib.util
import sys


class LegacyINotesFinder(importlib.abc.MetaPathFinder):
    """Compatibility shim for the old i_Notes import path.

    The checked-in source tree currently exposes the package under
    open_notebook/, while the runtime code and imports still reference
    i_Notes/. This finder maps legacy imports to the extracted package.
    """

    def find_spec(self, fullname, path=None, target=None):
        if fullname == "i_Notes":
            return importlib.util.find_spec("open_notebook")

        if fullname.startswith("i_Notes."):
            alias = "open_notebook" + fullname[len("i_Notes") :]
            try:
                return importlib.util.find_spec(alias)
            except (ImportError, ModuleNotFoundError):
                return None

        return None


if importlib.util.find_spec("open_notebook") is not None:
    sys.meta_path.insert(0, LegacyINotesFinder())
