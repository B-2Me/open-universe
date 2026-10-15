/* puff.h -- header for puff.c: a small inflate implementation
   Copyright (C) 2002-2013 Mark Adler, version 2.3, 25 Jan 2013
   This software is provided 'as-is', without any express or implied
   warranty.  See puff.c for the full notice. */

#ifndef PUFF_H
#define PUFF_H

#ifdef __cplusplus
extern "C" {
#endif

int puff(unsigned char *dest,           /* pointer to destination pointer */
         unsigned long *destlen,        /* amount of output space */
         const unsigned char *source,   /* pointer to source data pointer */
         unsigned long *sourcelen);     /* amount of input available */

#ifdef __cplusplus
}
#endif

#endif
