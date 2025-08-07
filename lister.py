import os
import json
try:
    from PIL import Image
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError as e:
    print("Got import error", e)
    print("You need to install pillow and pillow-heif: `pip3 install pillow pillow-heif`")
    import sys; sys.exit(1);

files = []
media_dir = "media"
if os.path.exists(media_dir):
    for file in os.listdir(media_dir):
        try:
            file_path = os.path.join(media_dir, file)
            im = Image.open(file_path)
            # Store the relative path including media/ prefix
            files.append([file_path, [im.width, im.height]])
        except: # e.g. .DS_Store, non-image files
            continue
else:
    # Fallback to current directory if media folder doesn't exist
    for file in os.listdir("."):
        try:
            im = Image.open(file)
            files.append([file, [im.width, im.height]])
        except: # e.g. .DS_Store, calculater.py, file
            continue
json.dump(files, open("image_widths_heights.json", 'w'))
print(f"Successfully created image_widths_heights.json with {len(files)} files.")