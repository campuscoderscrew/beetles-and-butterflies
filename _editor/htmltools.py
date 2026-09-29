"""HTML helpers for the local site editor.

Everything here works on the *source text* of a page and only ever rewrites the
exact characters that belong to an edited element, so the rest of the file is
left byte-for-byte untouched. Standard library only (Python 3.7+).
"""
import html
import re
from html.parser import HTMLParser

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}

# Elements whose text can be edited in place.
TEXT_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "a", "span",
             "strong", "em", "b", "i", "small", "figcaption", "blockquote",
             "td", "th", "dt", "dd", "cite", "label"}

# Tags allowed *inside* an editable text element.
INLINE_OK = {"a", "strong", "em", "b", "i", "br", "span", "small", "sup",
             "sub", "u", "mark", "cite"}

# Nothing inside these is ever made editable as text.
NO_TEXT_INSIDE = {"head", "script", "style", "select", "option", "textarea",
                  "button", "svg", "noscript", "title", "template"}
NO_IMG_INSIDE = {"head", "noscript", "template", "svg"}

EDIT_ATTR = "data-edit"
ATTRS_EDITABLE = {"src", "href", "data-comment", "alt"}


class EditError(Exception):
    pass


class Node(object):
    __slots__ = ("tag", "attrs", "s", "se", "e", "parent", "children", "text",
                 "raw", "void")

    def __init__(self, tag, attrs=None, s=0, se=0, parent=None, raw=""):
        self.tag = tag
        self.attrs = attrs or {}
        self.s = s            # offset of "<tag"
        self.se = se          # offset just after the start tag's ">"
        self.e = None         # offset of the matching "</tag" (None if unclosed)
        self.parent = parent
        self.children = []
        self.text = False     # has non-whitespace text directly inside
        self.raw = raw        # the start tag text exactly as written
        self.void = False

    def ancestors(self):
        n = self.parent
        while n is not None:
            yield n
            n = n.parent


class Tree(HTMLParser):
    """Parses a page and records the source offsets of every element."""

    def __init__(self, src):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.src = src
        self.line_starts = [0] + [m.end() for m in re.finditer("\n", src)]
        self.root = Node("#root")
        self.stack = [self.root]
        self.nodes = []
        self.feed(src)
        self.close()

    def _off(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def _open(self, tag, attrs, void):
        s = self._off()
        raw = self.get_starttag_text() or ""
        parent = self.stack[-1]
        n = Node(tag, dict((k, v if v is not None else "") for k, v in attrs),
                 s, s + len(raw), parent, raw)
        parent.children.append(n)
        self.nodes.append(n)
        if void or tag in VOID:
            n.void = True
            n.e = n.se
        else:
            self.stack.append(n)

    def handle_starttag(self, tag, attrs):
        self._open(tag, attrs, False)

    def handle_startendtag(self, tag, attrs):
        self._open(tag, attrs, True)

    def handle_endtag(self, tag):
        pos = self._off()
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack[i].e = pos
                del self.stack[i:]
                return

    def handle_data(self, data):
        if data.strip():
            self.stack[-1].text = True


# --------------------------------------------------------------- classification
def _inline_only(n):
    for c in n.children:
        if c.tag not in INLINE_OK:
            return False
        if not c.void and not _inline_only(c):
            return False
    return True


def _has_text(n):
    return n.text or any(_has_text(c) for c in n.children)


def classify(tree):
    """Return a list of (node, kind) in document order. kind is text/img/quote."""
    chosen_text = set()
    out = []
    for n in tree.nodes:
        anc = list(n.ancestors())
        anc_tags = set(a.tag for a in anc)
        if "data-comment" in n.attrs:
            out.append((n, "quote"))
            continue
        if n.tag == "img":
            if not (anc_tags & NO_IMG_INSIDE):
                out.append((n, "img"))
            continue
        if (n.tag in TEXT_TAGS and not n.void and n.e is not None
                and not (anc_tags & NO_TEXT_INSIDE)
                and not any(id(a) in chosen_text for a in anc)
                and _inline_only(n) and _has_text(n)):
            chosen_text.add(id(n))
            out.append((n, "text"))
    return out


# --------------------------------------------------------------- attribute helpers
def _attr_re(name):
    return re.compile(r'(\s' + re.escape(name) + r'\s*=\s*)("[^"]*"|\'[^\']*\'|[^\s>]+)', re.I)


def set_attr(raw, name, value):
    """Return the start tag `raw` with attribute `name` set to `value`."""
    quoted = '"' + html.escape(value, quote=True) + '"'
    rx = _attr_re(name)
    if rx.search(raw):
        return rx.sub(lambda m: m.group(1) + quoted, raw, count=1)
    if raw.endswith("/>"):
        return raw[:-2].rstrip() + " " + name + "=" + quoted + " />"
    return raw[:-1] + " " + name + "=" + quoted + ">"


def _apply(src, reps):
    """reps: list of (start, end, text). Applied from the end of the file backwards."""
    reps = sorted(reps, key=lambda r: r[0], reverse=True)
    last = len(src) + 1
    for s, e, _ in reps:
        if e > last:
            raise EditError("Two edits overlap; please save them one at a time.")
        last = s
    for s, e, t in reps:
        src = src[:s] + t + src[e:]
    return src


# --------------------------------------------------------------- tagging
def tag_page(src):
    """Give every editable element a unique data-edit id. Returns (new_src, count_changed)."""
    tree = Tree(src)
    items = classify(tree)
    used = set()
    nums = [int(m.group(1)) for m in re.finditer(r'data-edit="e(\d+)"', src)]
    counter = [max(nums) if nums else 0]

    def next_id():
        counter[0] += 1
        while "e%d" % counter[0] in used:
            counter[0] += 1
        return "e%d" % counter[0]

    reps = []
    for n, _kind in items:
        cur = n.attrs.get(EDIT_ATTR)
        if cur and cur not in used:
            used.add(cur)
            continue
        new = next_id()
        used.add(new)
        reps.append((n.s, n.se, set_attr(n.raw, EDIT_ATTR, new)))
    if not reps:
        return src, 0
    return _apply(src, reps), len(reps)


# --------------------------------------------------------------- sanitizing edited text
class _Sanitizer(HTMLParser):
    KEEP = {"strong": (), "em": (), "u": (), "small": (), "sup": (), "sub": (),
            "span": ("class",), "a": ("href", "target", "rel", "class")}
    RENAME = {"b": "strong", "i": "em"}
    BLOCKS = {"div", "p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote"}

    def __init__(self):
        HTMLParser.__init__(self, convert_charrefs=True)
        self.out = []
        self.open = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        tag = self.RENAME.get(tag, tag)
        if tag in ("script", "style"):
            self.skip += 1
        elif tag == "br":
            self.out.append("<br>")
        elif tag in self.KEEP:
            parts = []
            for k, v in attrs:
                if k in self.KEEP[tag] and v is not None:
                    if k == "href" and v.strip().lower().startswith("javascript:"):
                        continue
                    parts.append(' %s="%s"' % (k, html.escape(v, quote=True)))
            self.out.append("<%s%s>" % (tag, "".join(parts)))
            self.open.append(tag)
        elif tag in self.BLOCKS and self.out:
            self.out.append("<br>")

    def handle_startendtag(self, tag, attrs):
        if tag == "br":
            self.out.append("<br>")

    def handle_endtag(self, tag):
        tag = self.RENAME.get(tag, tag)
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        elif tag in self.open:
            while self.open:
                t = self.open.pop()
                self.out.append("</%s>" % t)
                if t == tag:
                    break

    def handle_data(self, data):
        if self.skip:
            return
        self.out.append(html.escape(data.replace(" ", " "), quote=False))

    def result(self):
        while self.open:
            self.out.append("</%s>" % self.open.pop())
        s = "".join(self.out)
        s = re.sub(r"(\s*<br>\s*)+$", "", s)
        return s


def sanitize(fragment):
    p = _Sanitizer()
    p.feed(fragment)
    p.close()
    return p.result()


# --------------------------------------------------------------- applying edits
def apply_edits(src, edits):
    """edits: [{"id":..., "type":"html", "value":...} | {"id":..., "type":"attr", "name":..., "value":...}]"""
    tree = Tree(src)
    by_id = {}
    for n in tree.nodes:
        i = n.attrs.get(EDIT_ATTR)
        if i:
            by_id.setdefault(i, []).append(n)

    def node_for(eid):
        ns = by_id.get(eid)
        if not ns:
            raise EditError("This page changed since it was opened (item %s not found). "
                            "Reload the page and make the change again." % eid)
        if len(ns) > 1:
            raise EditError("Item %s appears twice in the file. Restart the editor to fix this." % eid)
        return ns[0]

    reps = []
    attr_changes = {}   # node id -> (node, [(name, value)])
    for ed in edits:
        n = node_for(str(ed.get("id")))
        kind = ed.get("type")
        if kind == "html":
            if n.void or n.e is None:
                raise EditError("Item %s cannot hold text." % n.attrs.get(EDIT_ATTR))
            reps.append((n.se, n.e, sanitize(str(ed.get("value", "")))))
        elif kind == "attr":
            name = str(ed.get("name", ""))
            if name not in ATTRS_EDITABLE:
                raise EditError("The %s setting cannot be changed from the editor." % name)
            attr_changes.setdefault(id(n), (n, []))[1].append((name, str(ed.get("value", ""))))
        else:
            raise EditError("Unknown edit type.")
    for n, changes in attr_changes.values():
        raw = n.raw
        for name, value in changes:
            raw = set_attr(raw, name, value)
        reps.append((n.s, n.se, raw))
    return _apply(src, reps)
