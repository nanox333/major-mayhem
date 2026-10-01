from pathlib import Path
from PIL import Image, ImageFilter
import vtracer
p=Path(__file__).resolve().parent / 'assets'
for name in ['case','pro-silhouette']:
    im=Image.open(p/'sources'/f'{name}.png').convert('RGBA')
    im.thumbnail((480,480))
    # Clean color noise before tracing, keep alpha. Paths, not an embedded image.
    alpha=im.getchannel('A').point(lambda a: 255 if a >= 128 else 0)
    rgb=im.convert('RGB').filter(ImageFilter.MedianFilter(3))
    rgb=rgb.quantize(colors=12,method=Image.Quantize.MEDIANCUT).convert('RGB')
    rgb.putalpha(alpha)
    temp=p/f'.{name}-trace-input.png'; rgb.save(temp)
    vtracer.convert_image_to_svg_py(str(temp),str(p/f'{name}.svg'),colormode='color',hierarchical='stacked',mode='spline',filter_speckle=12,color_precision=6,layer_difference=32,corner_threshold=60,length_threshold=5,max_iterations=10,splice_threshold=45,path_precision=2)
    temp.unlink()
    path=p/f'{name}.svg'; s=path.read_text(); s=s.replace('<svg ', '<svg role="img" ',1); path.write_text(s)
    print(name, path.stat().st_size, 'bytes',s.count('<path'),'paths',flush=True)
