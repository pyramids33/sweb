#!/usr/bin/env bash

# see
# https://www.gnu.org/software/bash/manual/html_node/Programmable-Completion.html
# https://iridakos.com/programming/2018/03/01/bash-programmable-completion-tutorial

# the app already knows how to complete everything, so we
# call it using the same line, with tab character at the end, 
# it will show the completion but not execute

_denosweb_completions()
{
  eval "$COMP_LINE $'\t'"
}

complete -C _denosweb_completions ./denosweb
