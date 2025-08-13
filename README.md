# ddc-source-luasnip

A [LuaSnip](https://github.com/L3MON4D3/LuaSnip) source for
[ddc.vim](https://github.com/Shougo/ddc.vim).

This plugin provides snippet completion from LuaSnip in ddc.vim's completion
framework.

## Features

- 🚀 **High Performance**: Asynchronous snippet fetching with intelligent
  caching
- 🎯 **Context Aware**: Filetype-specific snippet completion
- ⚙️ **Highly Configurable**: Extensive customization options
- 🔄 **Real-time Updates**: Automatically reflects changes in LuaSnip snippets
- 🏷️ **Rich Information**: Detailed snippet information in completion menu

## Requirements

- [Neovim](https://neovim.io/) >= 0.10.0
- [ddc.vim](https://github.com/Shougo/ddc.vim)
- [denops.vim](https://github.com/vim-denops/denops.vim) >= 7.0
- [LuaSnip](https://github.com/L3MON4D3/LuaSnip)
- [Deno](https://deno.land/) >= 1.45

## Installation

### Using [vim-plug](https://github.com/junegunn/vim-plug)

```vim
Plug 'vim-denops/denops.vim'
Plug 'Shougo/ddc.vim'
Plug 'L3MON4D3/LuaSnip'
Plug 'your-username/ddc-source-luasnip'
```

### Using [packer.nvim](https://github.com/wbthomason/packer.nvim)

```lua
use {
  'your-username/ddc-source-luasnip',
  requires = {
    'vim-denops/denops.vim',
    'Shougo/ddc.vim',
    'L3MON4D3/LuaSnip'
  }
}
```

## Configuration

### Basic Setup

```vim
" Enable the luasnip source
call ddc#custom#patch_global('sources', ['luasnip'])

" Configure source options
call ddc#custom#patch_global('sourceOptions', {
      \   '_': {
      \     'matchers': ['matcher_head'],
      \     'sorters': ['sorter_rank'],
      \   },
      \   'luasnip': {
      \     'mark': '[LS]',
      \     'dup': v:false,
      \   },
      \ })

" Enable ddc
call ddc#enable()
```

### Advanced Configuration

```vim
call ddc#custom#patch_global('sourceParams', {
      \   'luasnip': {
      \     'enableCache': v:true,
      \     'cacheTimeout': 5000,
      \     'maxCandidates': 100,
      \     'filetypes': ['typescript', 'javascript', 'python'],
      \     'showCondition': v:true,
      \     'enableRegexTrigger': v:true,
      \   },
      \ })
```

### Lua Configuration (for Neovim)

```lua
local ddc = require('ddc')

-- Enable luasnip source
vim.fn['ddc#custom#patch_global']('sources', {'luasnip'})

-- Configure source options
vim.fn['ddc#custom#patch_global']('sourceOptions', {
  _ = {
    matchers = {'matcher_head'},
    sorters = {'sorter_rank'},
  },
  luasnip = {
    mark = '[LS]',
    dup = false,
  },
})

-- Configure source parameters
vim.fn['ddc#custom#patch_global']('sourceParams', {
  luasnip = {
    enableCache = true,
    cacheTimeout = 5000,
    maxCandidates = 100,
    filetypes = {'typescript', 'javascript', 'python'},
    showCondition = true,
    enableRegexTrigger = true,
  },
})

-- Enable ddc
vim.fn['ddc#enable']()
```

## Parameters

| Parameter            | Type     | Default    | Description                             |
| -------------------- | -------- | ---------- | --------------------------------------- |
| `mark`               | string   | `\"[LS]\"` | Mark text displayed in completion menu  |
| `dup`                | boolean  | `false`    | Allow duplicate items                   |
| `maxCandidates`      | number   | `500`      | Maximum number of completion candidates |
| `enableCache`        | boolean  | `true`     | Enable snippet caching for performance  |
| `cacheTimeout`       | number   | `5000`     | Cache timeout in milliseconds           |
| `filetypes`          | string[] | `[]`       | Allowed filetypes (empty = all)         |
| `excludeFiletypes`   | string[] | `[]`       | Excluded filetypes                      |
| `showCondition`      | boolean  | `true`     | Show conditional snippets               |
| `enableRegexTrigger` | boolean  | `true`     | Enable regex trigger snippets           |
| `debug`              | boolean  | `false`    | Enable debug logging                    |

## Examples

### Language-specific Configuration

```vim
\" Python-specific settings
call ddc#custom#patch_filetype('python', 'sources', ['luasnip', 'lsp'])
call ddc#custom#patch_filetype('python', 'sourceParams', {
      \   'luasnip': {
      \     'maxCandidates': 50,
      \   },
      \ })

\" JavaScript/TypeScript settings
call ddc#custom#patch_filetype(['javascript', 'typescript'], 'sourceParams', {
      \   'luasnip': {
      \     'enableCache': v:true,
      \     'showCondition': v:true,
      \   },
      \ })
```

### Integration with Other Plugins

```vim
\" Use with other completion sources
call ddc#custom#patch_global('sources', ['luasnip', 'lsp', 'around', 'file'])

\" Configure source priorities
call ddc#custom#patch_global('sourceOptions', {
      \   'luasnip': {'mark': '[LS]'},
      \   'lsp': {'mark': '[LSP]'},
      \   'around': {'mark': '[A]'},
      \   'file': {'mark': '[F]'},
      \ })
```

## Troubleshooting

### LuaSnip Not Found

If you see warnings about LuaSnip not being available:

1. Ensure LuaSnip is properly installed
2. Verify LuaSnip is loaded before ddc.vim
3. Check that you can run `:lua require('luasnip')` without errors

### No Completion Candidates

If no snippets appear in completion:

1. Check that snippets are loaded in LuaSnip:
   `:lua print(#require('luasnip').get_snippets())`
2. Verify filetype settings match your current buffer
3. Check `excludeFiletypes` parameter
4. Enable debug mode: `'debug': v:true`

### Performance Issues

For better performance with large snippet collections:

```vim
call ddc#custom#patch_global('sourceParams', {
      \   'luasnip': {
      \     'enableCache': v:true,
      \     'maxCandidates': 100,
      \     'cacheTimeout': 10000,
      \   },
      \ })
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests: `deno task test`
6. Submit a pull request

## Development

### Running Tests

```bash
deno task test
```

### Linting and Formatting

```bash
deno task lint
deno task fmt
```

### Type Checking

```bash
deno task check
```

## License

MIT License. See [LICENSE](LICENSE) for details.

## Acknowledgments

- [Shougo](https://github.com/Shougo) for creating ddc.vim
- [L3MON4D3](https://github.com/L3MON4D3) for LuaSnip
- [vim-denops](https://github.com/vim-denops) team for denops.vim
