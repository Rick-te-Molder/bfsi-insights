#!/usr/bin/env python3
"""
Render first page of PDF to JPEG image
Usage: python render-pdf.py <pdf_path> <output_path>
"""

import sys
import json
from pathlib import Path

try:
    from pdf2image import convert_from_path
    from PIL import Image
except ImportError as e:
    print(json.dumps({
        "success": False,
        "message": f"Missing required package: {e}. Install with: pip install pdf2image Pillow"
    }))
    sys.exit(1)

def render_pdf_first_page(pdf_path, output_path, dpi=150, target_width=None, target_height=None):
    """Render first page of PDF to JPEG, optionally resizing to target dimensions"""
    try:
        # Convert first page only
        images = convert_from_path(pdf_path, dpi=dpi, first_page=1, last_page=1)
        
        if not images:
            return {
                "success": False,
                "message": "No pages found in PDF"
            }
        
        # Get first page
        first_page = images[0]
        
        # Convert to RGB if necessary (PDFs can be RGBA)
        if first_page.mode == 'RGBA':
            rgb_image = Image.new('RGB', first_page.size, (255, 255, 255))
            rgb_image.paste(first_page, mask=first_page.split()[3])
            first_page = rgb_image
        
        # Resize to target dimensions if specified
        if target_width and target_height:
            # Calculate scaling to fit within target dimensions while maintaining aspect ratio
            width_ratio = target_width / first_page.width
            height_ratio = target_height / first_page.height
            scale_ratio = min(width_ratio, height_ratio)
            
            new_width = int(first_page.width * scale_ratio)
            new_height = int(first_page.height * scale_ratio)
            
            # Resize the image
            first_page = first_page.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Create a canvas with target dimensions and center the resized image
            canvas = Image.new('RGB', (target_width, target_height), (255, 255, 255))
            x_offset = (target_width - new_width) // 2
            y_offset = (target_height - new_height) // 2
            canvas.paste(first_page, (x_offset, y_offset))
            first_page = canvas
        
        # Save as JPEG
        first_page.save(output_path, 'JPEG', quality=80, optimize=True)
        
        return {
            "success": True,
            "output_path": str(output_path),
            "width": first_page.width,
            "height": first_page.height
        }
        
    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to render PDF: {str(e)}"
        }

if __name__ == '__main__':
    if len(sys.argv) < 3 or len(sys.argv) > 5:
        print(json.dumps({
            "success": False,
            "message": "Usage: render-pdf.py <pdf_path> <output_path> [width] [height]"
        }))
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    output_path = sys.argv[2]
    target_width = int(sys.argv[3]) if len(sys.argv) > 3 else None
    target_height = int(sys.argv[4]) if len(sys.argv) > 4 else None
    
    if not Path(pdf_path).exists():
        print(json.dumps({
            "success": False,
            "message": f"PDF file not found: {pdf_path}"
        }))
        sys.exit(1)
    
    result = render_pdf_first_page(pdf_path, output_path, target_width=target_width, target_height=target_height)
    print(json.dumps(result))
    
    if not result["success"]:
        sys.exit(1)
