// Requires WorldJS for NeoForge 1.21.1.
// Registers a custom terrain-following deep-sea minefield feature.

const BuiltInRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries')
const ResourceLocation = Java.loadClass('net.minecraft.resources.ResourceLocation')
const FluidTags = Java.loadClass('net.minecraft.tags.FluidTags')

function recordMinefield(level, x, z) {
    try {
        const serverLevel = level.getLevel()
        const server = serverLevel.getServer()
        const dimension = serverLevel.dimension().location().toString()
        const entry = dimension + ',' + Math.round(x) + ',' + Math.round(z)

        server.execute(() => {
            const data = server.persistentData
            const key = 'alliumMinefieldCenters'
            const current = data.getString(key)
            const entries = current.length > 0 ? current.split(';') : []

            if (entries.indexOf(entry) == -1) {
                entries.push(entry)
                data.putString(key, entries.join(';'))
            }
        })
    } catch (error) {
        console.error('[Allium Minefields] Could not record minefield center: ' + error)
    }
}

function blockById(id) {
    return BuiltInRegistries.BLOCK.get(ResourceLocation.parse(id))
}

function defaultState(block) {
    return block.defaultBlockState()
}

function distanceSquared(a, b) {
    let dx = a[0] - b[0]
    let dz = a[1] - b[1]
    return dx * dx + dz * dz
}

function farEnough(point, points, minimum) {
    let minSq = minimum * minimum
    for (let p of points) {
        if (distanceSquared(point, p) < minSq) return false
    }
    return true
}

function generateAmoeba(random, count) {
    let points = [[0.0, 0.0]]
    let lobes = [[0.0, 0.0]]
    let attempts = 0

    while (points.length < count && attempts++ < 100000) {
        if (lobes.length < 5 && random.nextFloat() < 0.018) {
            lobes.push(points[random.nextInt(points.length)])
        }

        let base = points[random.nextInt(points.length)]
        let lobe = lobes[random.nextInt(lobes.length)]
        let toward = Math.atan2(lobe[1] - base[1], lobe[0] - base[0])
        if (base[0] == lobe[0] && base[1] == lobe[1]) {
            toward = random.nextDouble() * Math.PI * 2.0
        }

        let angle = toward + (random.nextDouble() * 3.0 - 1.5)
        let distance = 5.0 + random.nextDouble() * 5.0
        let candidate = [
            base[0] + Math.cos(angle) * distance,
            base[1] + Math.sin(angle) * distance
        ]

        if (candidate[0] * candidate[0] + candidate[1] * candidate[1] > 55.0 * 55.0) continue
        if (farEnough(candidate, points, 5.0)) points.push(candidate)
    }
    return points
}

function generateLine(random, count) {
    let backbone = []
    let x = 0.0
    let z = 0.0
    let angle = random.nextDouble() * 0.6 - 0.3
    let backboneCount = Math.max(18, Math.floor(count * 0.58))

    for (let i = 0; i < backboneCount; i++) {
        backbone.push([x, z])
        angle += random.nextDouble() * 0.7 - 0.35
        let step = 5.5 + random.nextDouble() * 4.0
        x += Math.cos(angle) * step
        z += Math.sin(angle) * step
    }

    let points = backbone.slice()
    let attempts = 0
    while (points.length < count && attempts++ < 100000) {
        let index = random.nextInt(backbone.length)
        let base = backbone[index]
        let next = backbone[Math.min(index + 1, backbone.length - 1)]
        let lineAngle = Math.atan2(next[1] - base[1], next[0] - base[0])
        let side = random.nextBoolean() ? 1.0 : -1.0
        let angle2 = lineAngle + side * Math.PI / 2.0 + (random.nextDouble() - 0.5)
        let distance = 5.0 + random.nextDouble() * 5.0
        let candidate = [
            base[0] + Math.cos(angle2) * distance,
            base[1] + Math.sin(angle2) * distance
        ]
        if (farEnough(candidate, points, 5.0)) points.push(candidate)
    }
    return points
}

function generateBranching(random, count) {
    let main = generateLine(random, Math.floor(count * 0.65))
    let points = main.slice()
    let origins = []
    for (let i = 0; i < 3; i++) {
        origins.push(main[3 + random.nextInt(Math.max(1, main.length - 6))])
    }

    let attempts = 0
    while (points.length < count && attempts++ < 100000) {
        let origin = origins[random.nextInt(origins.length)]
        let base = random.nextFloat() < 0.55 ? points[random.nextInt(points.length)] : origin
        let angle = Math.atan2(base[1] - origin[1], base[0] - origin[0])
        if (base[0] == origin[0] && base[1] == origin[1]) {
            angle = random.nextDouble() * Math.PI * 2.0
        }
        angle += random.nextDouble() * 1.6 - 0.8
        let distance = 5.0 + random.nextDouble() * 5.0
        let candidate = [
            base[0] + Math.cos(angle) * distance,
            base[1] + Math.sin(angle) * distance
        ]
        if (farEnough(candidate, points, 5.0)) points.push(candidate)
    }
    return points
}

function addOutliers(random, points) {
    let outlierCount = 4 + random.nextInt(4)
    let centerX = 0.0
    let centerZ = 0.0
    for (let p of points) {
        centerX += p[0]
        centerZ += p[1]
    }
    centerX /= points.length
    centerZ /= points.length

    let ranked = points.slice().sort((a, b) => {
        let da = (a[0] - centerX) ** 2 + (a[1] - centerZ) ** 2
        let db = (b[0] - centerX) ** 2 + (b[1] - centerZ) ** 2
        return db - da
    })

    for (let i = 0; i < outlierCount; i++) {
        let base = ranked[random.nextInt(Math.min(12, ranked.length))]
        let angle = Math.atan2(base[1] - centerZ, base[0] - centerX)
        angle += random.nextDouble() * 0.6 - 0.3
        let distance = 11.0 + random.nextDouble() * 4.0
        let candidate = [
            base[0] + Math.cos(angle) * distance,
            base[1] + Math.sin(angle) * distance
        ]
        if (farEnough(candidate, points, 5.0)) points.push(candidate)
    }
}

function isWater(level, pos) {
    return level.getBlockState(pos).getFluidState().is(FluidTags.WATER)
}

function isSolidFloor(level, pos) {
    const state = level.getBlockState(pos)
    return !state.isAir() && state.getFluidState().isEmpty()
}

function findOceanColumn(level, mutable, x, z, centerY) {
    const minY = level.getMinBuildHeight()
    const maxY = level.getMaxBuildHeight() - 1
    const scanTop = Math.min(maxY, Math.max(96, centerY + 192))

    let surfaceY = null
    let floorY = null
    let sawWater = false

    for (let y = scanTop; y >= minY + 1; y--) {
        mutable.set(x, y, z)
        const waterHere = isWater(level, mutable)

        if (waterHere) {
            if (!sawWater) {
                surfaceY = y
                sawWater = true
            }
            continue
        }

        if (sawWater) {
            if (isSolidFloor(level, mutable)) {
                floorY = y + 1
                break
            }

            sawWater = false
            surfaceY = null
        }
    }

    if (surfaceY == null || floorY == null) return null

    return {
        floorY: floorY,
        surfaceY: surfaceY,
        waterDepth: surfaceY - floorY + 1
    }
}

StartupEvents.registry('worldgen/feature', event => {
    event.create('deep_sea_minefield')
        .placeFunction((level, chunkGenerator, random, origin) => {
            return (function(alliumLevel, alliumChunkGenerator, alliumRandom, alliumOrigin) {
                try {
                    alliumRandom = alliumRandom.forkPositional().at(alliumOrigin)

                    var chainState = defaultState(blockById('dndecor:large_industrial_chain'))
                    var mineState = defaultState(blockById('create_submarine:underwater_mine'))

                    let total = 40 + alliumRandom.nextInt(21)
                    let shape = alliumRandom.nextInt(3)
                    let points = shape == 0
                        ? generateAmoeba(alliumRandom, total)
                        : shape == 1
                            ? generateLine(alliumRandom, total)
                            : generateBranching(alliumRandom, total)

                    addOutliers(alliumRandom, points)

                    let indices = []
                    for (let i = 0; i < points.length; i++) indices.push(i)

                    for (let i = indices.length - 1; i > 0; i--) {
                        let j = alliumRandom.nextInt(i + 1)
                        let temp = indices[i]
                        indices[i] = indices[j]
                        indices[j] = temp
                    }

                    let drifterCount = 1 + alliumRandom.nextInt(3)
                    let brokenCount = Math.max(4, Math.floor(points.length * (0.08 + alliumRandom.nextDouble() * 0.06)))
                    let drifters = new Set(indices.slice(0, drifterCount))
                    let broken = new Set(indices.slice(drifterCount, drifterCount + brokenCount))

                    let placed = false
                    let mutable = alliumOrigin.mutable()

                    for (let i = 0; i < points.length; i++) {
                        let x = alliumOrigin.getX() + Math.round(points[i][0])
                        let z = alliumOrigin.getZ() + Math.round(points[i][1])

                        const column = findOceanColumn(alliumLevel, mutable, x, z, alliumOrigin.getY())
                        if (column == null) continue

                        const floorY = column.floorY
                        const surfaceY = column.surfaceY
                        const waterDepth = column.waterDepth

                        if (waterDepth < 28) continue

                        mutable.set(x, floorY, z)
                        if (!isWater(alliumLevel, mutable)) continue

                        if (drifters.has(i)) {
                            let altitude = 25 + alliumRandom.nextInt(16)
                            if (floorY + altitude >= surfaceY - 4) continue

                            let dangling = 1 + alliumRandom.nextInt(3)
                            for (let y = floorY + altitude - dangling; y < floorY + altitude; y++) {
                                mutable.set(x, y, z)
                                if (isWater(alliumLevel, mutable)) alliumLevel.setBlock(mutable, chainState, 2)
                            }
                            mutable.set(x, floorY + altitude, z)
                            if (isWater(alliumLevel, mutable)) {
                                alliumLevel.setBlock(mutable, mineState, 2)
                                placed = true
                            }
                            continue
                        }

                        if (broken.has(i) && alliumRandom.nextFloat() < 0.45) {
                            let remnant = 1 + alliumRandom.nextInt(5)
                            for (let y = floorY; y < floorY + remnant; y++) {
                                mutable.set(x, y, z)
                                if (isWater(alliumLevel, mutable)) alliumLevel.setBlock(mutable, chainState, 2)
                            }
                            placed = true
                            continue
                        }

                        let length = 10 + alliumRandom.nextInt(9)
                        if (floorY + length + 1 >= surfaceY - 3) continue

                        let gapStart = -1
                        let gapLength = 0
                        if (broken.has(i)) {
                            gapStart = 3 + alliumRandom.nextInt(Math.max(1, length - 6))
                            gapLength = 1 + alliumRandom.nextInt(3)
                        }

                        for (let step = 0; step < length; step++) {
                            if (gapStart >= 0 && step >= gapStart && step < gapStart + gapLength) continue
                            mutable.set(x, floorY + step, z)
                            if (isWater(alliumLevel, mutable)) alliumLevel.setBlock(mutable, chainState, 2)
                        }

                        mutable.set(x, floorY + length, z)
                        if (isWater(alliumLevel, mutable)) {
                            alliumLevel.setBlock(mutable, mineState, 2)
                            placed = true
                        }
                    }

                    if (placed) {
                        recordMinefield(alliumLevel, alliumOrigin.getX(), alliumOrigin.getZ())
                    } else {
                        console.warn(
                            '[Allium Minefields] Feature ran but placed zero blocks at ' +
                            alliumOrigin.getX() + ', ' + alliumOrigin.getY() + ', ' + alliumOrigin.getZ()
                        )
                    }
                    return placed
                } catch (error) {
                    console.error(
                        '[Allium Minefields] Placement exception at ' +
                        alliumOrigin.getX() + ', ' + alliumOrigin.getY() + ', ' + alliumOrigin.getZ() +
                        ': ' + error
                    )
                    return false
                }
            })(level, chunkGenerator, random, origin)
        })
})
