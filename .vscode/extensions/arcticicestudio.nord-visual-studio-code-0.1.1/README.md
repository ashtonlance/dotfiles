<p align="center"><img src="https://cdn.rawgit.com/arcticicestudio/nord-visual-studio-code/develop/assets/nord-visual-studio-code-banner.svg"/></p>

<p align="center"><img src="https://cdn.travis-ci.org/images/favicon-c566132d45ab1a9bcae64d8d90e4378a.svg" width=24 height=24/> <a href="https://travis-ci.org/arcticicestudio/nord-visual-studio-code"><img src="https://img.shields.io/travis/arcticicestudio/nord-visual-studio-code/develop.svg"/></a> <img src="https://circleci.com/favicon.ico" width=24 height=24/> <a href="https://circleci.com/gh/arcticicestudio/nord-visual-studio-code"><img src="https://circleci.com/gh/arcticicestudio/nord-visual-studio-code.svg?style=shield&circle-token=42c0265eb1284bbb75805cf5aa4c61af01de242c"/></a> <img src="https://assets-cdn.github.com/favicon.ico" width=24 height=24/> <a href="https://github.com/arcticicestudio/nord-visual-studio-code/releases/latest"><img src="https://img.shields.io/github/release/arcticicestudio/nord-visual-studio-code.svg"/></a> <a href="https://github.com/arcticicestudio/nord/releases/tag/v0.2.0"><img src="https://img.shields.io/badge/Nord-v0.2.0-88C0D0.svg"/></a> <img src="https://marketplace.visualstudio.com/favicon.ico" width=24 height=24/> <a href="https://code.visualstudio.com/updates/v1_9"><img src="https://img.shields.io/badge/VS_Code-v1.9+-373277.svg"/></a> <a href="https://marketplace.visualstudio.com/items/arcticicestudio.nord-visual-studio-code"><img src="http://vsmarketplacebadge.apphb.com/version/arcticicestudio.nord-visual-studio-code.svg"/></a> <a href="https://marketplace.visualstudio.com/items/arcticicestudio.nord-visual-studio-code"><img src="http://vsmarketplacebadge.apphb.com/installs/arcticicestudio.nord-visual-studio-code.svg"/></a> <a href="https://marketplace.visualstudio.com/items/arcticicestudio.nord-visual-studio-code"><img src="http://vsmarketplacebadge.apphb.com/rating-short/arcticicestudio.nord-visual-studio-code.svg"/></a></p>

<p align="center">A arctic, north-bluish clean and elegant <a href="https://code.visualstudio.com">Visual Studio Code</a> theme.</p>

<p align="center">Designed for a fluent and clear workflow.<br>
Based on the <a href="https://github.com/arcticicestudio/nord">Nord</a> color palette.</p>

<p align="center"><img src="https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-top.png"/><br><blockquote>Icons provided by <a href="https://marketplace.visualstudio.com/items?itemName=PKief.material-icon-theme">Material Icon Theme</a>.<br>Font: <a href="https://adobe-fonts.github.io/source-code-pro">Source Code Pro</a> 20px</blockquote></p>

## Getting started
### Installation
#### <img src="https://marketplace.visualstudio.com/favicon.ico" width=16 height=16/> [VS Code Extension Marketplace](https://code.visualstudio.com/docs/editor/extension-gallery)
Launch *Quick Open*
  - <img src="https://www.kernel.org/theme/images/logos/favicon.png" width=16 height=16/> <a href="https://code.visualstudio.com/shortcuts/keyboard-shortcuts-linux.pdf">Linux</a> `Ctrl+P`
  - <img src="https://developer.apple.com/favicon.ico" width=16 height=16/> <a href="https://code.visualstudio.com/shortcuts/keyboard-shortcuts-macos.pdf">macOS</a> `⌘P`
  - <img src="https://www.microsoft.com/favicon.ico" width=16 height=16/> <a href="https://code.visualstudio.com/shortcuts/keyboard-shortcuts-windows.pdf">Windows</a> `Ctrl+P`

Paste the following command and press `Enter`:
```shell
ext install nord-visual-studio-code
```

#### <img src="https://marketplace.visualstudio.com/favicon.ico" width=16 height=16/> [Packaged VSIX Extension](https://code.visualstudio.com/docs/extensions/install-extension#_install-from-a-vsix)
[Download](https://github.com/arcticicestudio/nord-visual-studio-code/releases/latest) the latest [`nord-visual-studio-code-0.1.1.vsix`](https://github.com/arcticicestudio/nord-visual-studio-code/releases/download/0.1.1/nord-visual-studio-code-0.1.1.vsix) file from the GitHub repository and install it from the command line
```shell
code --install-extension nord-visual-studio-code-0.1.1.vsix
```
or from within VS Code by launching *Quick Open* and running the *Install from VSIX...* command.

#### From Source
Continuous integration builds are running at [Travis-CI](https://travis-ci.org/arcticicestudio/nord-visual-studio-code) and [Circle CI](https://circleci.com/gh/arcticicestudio/nord-visual-studio-code).

##### <img src="https://github.com/favicon.ico" width=16 height=16/> [GitHub Repository Clone](https://help.github.com/articles/cloning-a-repository)
Change to your `.vscode/extensions` [VS Code extensions directory](https://code.visualstudio.com/docs/extensions/install-extension#_side-loading).
Depending on your platform it is located in the following folders:
  - <img src="https://www.kernel.org/theme/images/logos/favicon.png" width=16 height=16/> **Linux** `~/.vscode/extensions`
  - <img src="https://developer.apple.com/favicon.ico" width=16 height=16/> **macOs** `~/.vscode/extensions`
  - <img src="https://www.microsoft.com/favicon.ico" width=16 height=16/> **Windows** `%USERPROFILE%\.vscode\extensions`

Clone the Nord repository as `nord-visual-studio-code`:
```shell
git clone https://github.com/arcticicestudio/nord-visual-studio-code arcticicestudio.nord-visual-studio-code
```

##### <img src="https://marketplace.visualstudio.com/favicon.ico" width=16 height=16/> [VSIX Package Extension Build](https://code.visualstudio.com/docs/extensions/install-extension#_sharing-privately-with-others)
The VSIX package extension file can be build from source using the [`vsce` publishing tool](https://code.visualstudio.com/docs/tools/vscecli) by running
```shell
vsce package
```
from the command line.

### [Activation](https://code.visualstudio.com/docs/customization/themes)
Launch *Quick Open*,
  - <img src="https://www.kernel.org/theme/images/logos/favicon.png" width=16 height=16/> <a href="https://code.visualstudio.com/shortcuts/keyboard-shortcuts-linux.pdf">Linux</a> `Ctrl+P`
  - <img src="https://developer.apple.com/favicon.ico" width=16 height=16/> <a href="https://code.visualstudio.com/shortcuts/keyboard-shortcuts-macos.pdf">macOS</a> `⌘P`
  - <img src="https://www.microsoft.com/favicon.ico" width=16 height=16/> <a href="https://code.visualstudio.com/shortcuts/keyboard-shortcuts-windows.pdf">Windows</a> `Ctrl+P`

run the `Preferences: Color Theme` command and select `Nord` from the drop-down menu.

The color theme drop-down can alternatively be opened via *File* (*Code* on macOS) > *Preferences* > *Color Theme*.

## Features
<p align="center"><strong>Non-obtrusive cusror line and search marker.</strong><br><img src="https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-feature-cursorline.png"/><br><img src="https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-feature-search.png"/><br><img src="https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrcast-feature-search.gif"/></p>

<p align="center"><strong>Colors of selected code can still be easily recognized.</strong><br><img src="https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrcast-feature-selection.gif"/></p>

## Languages
This theme contains optimized styles to achieve a consistent and uniform coloring across languages.  
Detailed descriptions for supported languages can be found in the [project wiki](https://github.com/arcticicestudio/nord-visual-studio-code/wiki).

![][scrot-lang-c]
![][scrot-lang-css]
![][scrot-lang-diff]
![][scrot-lang-java]
![][scrot-lang-javascript]
![][scrot-lang-json]
![][scrot-lang-markdown]
![][scrot-lang-php]
![][scrot-lang-python]
![][scrot-lang-ruby]
![][scrot-lang-xml]
![][scrot-lang-yaml]

## Development
[![](https://img.shields.io/badge/Changelog-0.1.1-81A1C1.svg)](https://github.com/arcticicestudio/nord-visual-studio-code/blob/v0.1.1/CHANGELOG.md) [![](https://img.shields.io/badge/Workflow-gitflow--branching--model-81A1C1.svg)](http://nvie.com/posts/a-successful-git-branching-model) [![](https://img.shields.io/badge/Versioning-ArcVer_0.8.0-81A1C1.svg)](https://github.com/arcticicestudio/arcver)

### Contribution
Please report issues/bugs, feature requests and suggestions for improvements to the [issue tracker](https://github.com/arcticicestudio/nord-visual-studio-code/issues).

<p align="center"><img src="https://cdn.rawgit.com/arcticicestudio/nord/develop/src/assets/banner-footer-mountains.svg" /></p>

<p align="center"> <img src="http://arcticicestudio.com/favicon.ico" width=16 height=16/> Copyright &copy; 2017 Arctic Ice Studio</p>

<p align="center"><a href="http://www.apache.org/licenses/LICENSE-2.0"><img src="https://img.shields.io/badge/License-Apache_2.0-5E81AC.svg"/></a> <a href="https://creativecommons.org/licenses/by-sa/4.0"><img src="https://img.shields.io/badge/License-CC_BY--SA_4.0-5E81AC.svg"/></a></p>

[scrot-lang-c]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-c.png
[scrot-lang-css]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-css.png
[scrot-lang-diff]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-diff.png
[scrot-lang-java]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-java.png
[scrot-lang-javascript]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-javascript.png
[scrot-lang-json]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-json.png
[scrot-lang-markdown]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-markdown.png
[scrot-lang-php]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-php.png
[scrot-lang-python]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-python.png
[scrot-lang-ruby]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-ruby.png
[scrot-lang-xml]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-xml.png
[scrot-lang-yaml]: https://raw.githubusercontent.com/arcticicestudio/nord-visual-studio-code/develop/assets/scrot-lang-yaml.png
