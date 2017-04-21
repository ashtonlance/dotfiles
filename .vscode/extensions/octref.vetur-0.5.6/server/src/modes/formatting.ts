/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { applyEdits } from '../utils/edits';
import { TextDocument, Range, TextEdit, FormattingOptions } from 'vscode-languageserver-types';
import { LanguageModes } from './languageModes';

export function format(languageModes: LanguageModes, document: TextDocument, formatRange: Range, formattingOptions: FormattingOptions, enabledModes: { [mode: string]: boolean }) {
  let htmlMode = languageModes.getMode('vue-html');

  let embeddedModeRanges = languageModes.getModesInRange(document, formatRange);
  let embeddedEdits: TextEdit[] = [];

  embeddedModeRanges.forEach(range => {
    const { start, end, mode }  = range;
    if (mode && mode.format) {
      const edits = mode.format(document, range, formattingOptions);
      for (let edit of edits) {
        embeddedEdits.push(edit);
      }
    }
  })

  return embeddedEdits;
}
