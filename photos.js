// Photos: shrink before upload, cache for a year, and show small copies in lists.
// Keeps Supabase "cached egress" (Free plan: 5 GB a month) low. A phone photo is 1-4 MB;
// a shrunk one is about 150 KB and its list-size copy about 30 KB.
(function () {
  var FULL = 1280, THUMB = 480, YEAR = '31536000';

  function base() { return (window.UC_CONFIG || {}).url || ''; }
  // Small copies exist only on the real project (the judges' demo serves its own sample files)
  function live() { return /supabase\.co/.test(base()); }
  function url(path) { return base() + '/storage/v1/object/public/listing-photos/' + encodeURI(path); }
  function thumbPath(path) { return path.replace(/\.[^./]+$/, '') + '-t.jpg'; }

  // Resolves to a JPEG no wider or taller than max, or the original file if that is smaller or can't be read
  function shrink(file, max, quality) {
    return new Promise(function (res) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        URL.revokeObjectURL(u);
        var s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        var g = c.getContext('2d');
        g.fillStyle = '#fff';  // transparent PNGs would turn black as JPEG
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(im, 0, 0, c.width, c.height);
        c.toBlob(function (b) { res(b && (b.size < file.size || s < 1) ? b : file); }, 'image/jpeg', quality || 0.8);
      };
      im.onerror = function () { URL.revokeObjectURL(u); res(file); };
      im.src = u;
    });
  }

  // Uploads a shrunk photo (o.max px, default 1280), plus a list-size copy when o.thumb. Resolves to the stored path.
  function upload(db, bucket, folderAndName, file, o) {
    var opts = { contentType: 'image/jpeg', cacheControl: YEAR }, withThumb = o && o.thumb;
    return shrink(file, (o && o.max) || FULL).then(function (big) {
      var path = folderAndName + '.' + (big === file ? ((file.name.split('.').pop() || 'jpg').toLowerCase()) : 'jpg');
      return db.storage.from(bucket).upload(path, big, Object.assign({}, opts, { contentType: big.type || file.type })).then(function (u) {
        if (u.error) throw u.error;
        if (!withThumb) return path;
        // The small copy is a bonus: lists fall back to the full photo if it's missing
        return shrink(file, THUMB, 0.75).then(function (t) {
          return db.storage.from(bucket).upload(thumbPath(path), t, opts);
        }).then(function () { return path; }, function () { return path; });
      });
    });
  }

  // <img> for a list or card: the small copy, falling back to the full photo, then to onFail
  function thumbImg(img, path, onFail) {
    img.decoding = 'async';
    if (!live()) { img.src = url(path); if (onFail) img.onerror = onFail; return img; }
    img.onerror = function () {
      img.onerror = onFail || null;
      img.src = url(path);
    };
    img.src = url(thumbPath(path));
    return img;
  }

  window.PasaPhoto = { url: url, thumbPath: thumbPath, shrink: shrink, upload: upload, thumbImg: thumbImg, CACHE: YEAR };
})();
