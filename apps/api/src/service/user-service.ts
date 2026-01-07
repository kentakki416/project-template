import { logger } from '../log'
import { UserRepository } from '../repository/mysql'
import { User } from '../types/domain'

/**
 * ユーザーIDからユーザー情報を取得
 */
export const getUserById = async (
    userId: number,
    userRepository: UserRepository
): Promise<User | null> => {
    logger.debug('UserService: Fetching user by ID', {
        userId,
    })
    const user = await userRepository.findById(userId)
    if (user) {
        logger.debug('UserService: User found', {
            userId: user.id,
        })
    } else {
        logger.debug('UserService: User not found', {
            userId,
        })
    }
    return user
}
