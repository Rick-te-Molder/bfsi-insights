#!/usr/bin/env python3
"""
PDF text extraction using PyMuPDF (fitz)
Usage: python3 extract-pdf.py <pdf_url>
Output: JSON with extracted text and metadata
"""

import sys
import json
import io
import ssl
import urllib.request
import fitz  # PyMuPDF


def extract_pdf_from_url(url):
    """
    Download and extract text from PDF URL
    """
    try:
        # Download PDF
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; BFSI-Insights/1.0)'
        }
        req = urllib.request.Request(url, headers=headers)
        
        # Create SSL context that doesn't verify certificates (for corporate/CDN certs)
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        with urllib.request.urlopen(req, timeout=30, context=ssl_context) as response:
            pdf_data = response.read()
        
        # Extract text using PyMuPDF
        pdf_file = io.BytesIO(pdf_data)
        
        all_text = []
        metadata = {}
        
        with fitz.open(stream=pdf_file, filetype="pdf") as pdf:
            metadata = {
                'pages': pdf.page_count,
                'metadata': pdf.metadata
            }
            
            for page_num in range(pdf.page_count):
                page = pdf[page_num]
                text = page.get_text("text", sort=True)  # Extract text with sorting
                if text:
                    all_text.append(text)
        
        full_text = '\n\n'.join(all_text)
        
        # Clean up text - normalize whitespace and remove excessive newlines
        full_text = ' '.join(full_text.split())
        
        return {
            'success': True,
            'text': full_text,
            'pages': metadata['pages'],
            'char_count': len(full_text),
            'metadata': metadata.get('metadata', {})
        }
        
    except urllib.error.URLError as e:
        return {
            'success': False,
            'error': 'download_failed',
            'message': f'Failed to download PDF: {str(e)}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': 'extraction_failed',
            'message': f'Failed to extract PDF: {str(e)}'
        }


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print(json.dumps({
            'success': False,
            'error': 'invalid_args',
            'message': 'Usage: python3 extract-pdf.py <pdf_url>'
        }))
        sys.exit(1)
    
    url = sys.argv[1]
    result = extract_pdf_from_url(url)
    print(json.dumps(result))
